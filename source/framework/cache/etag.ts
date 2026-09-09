import type {RequestContext} from "../../core/context.ts";
import type {ETagOptions, ETagResult} from "./types.ts";
import {HttpStatus} from "../enums/index.ts";

const DEFAULT_HEADER_NAME = 'ETag';

/**
 * Hachage FNV-1a (32 bits) utilisé par défaut pour générer une valeur d'ETag
 * stable à partir du corps sérialisé de la réponse.
 */
function fnv1a(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16);
}

/**
 * Sérialise un corps de réponse en chaîne de caractères, de la même manière
 * que les runtimes du framework le font avant l'envoi.
 */
function serialize(body: any): string {
    if (body === undefined || body === null) return '';
    if (typeof body === 'string') return body;
    if (Buffer.isBuffer(body)) return body.toString();
    if (typeof body === 'object' && !(body instanceof Response)) return JSON.stringify(body);
    return String(body);
}

/**
 * `Etagger` est le gestionnaire complet des ETag. Il est entièrement
 * personnalisable par le développeur : algorithme de hachage, marqueur faible,
 * en-tête, cache-control et prédicat d'exclusion.
 *
 * @example
 * const etagger = new Etagger({ weak: true, cacheControl: { maxAge: 300 } })
 * const { tag, notModified } = await etagger.evaluate(context, body)
 */
export class Etagger {
    private readonly enabled: boolean;
    private readonly weak: boolean;
    private readonly algorithm?: (body: string) => string | Promise<string>;
    private readonly cacheControl?: ETagOptions['cacheControl'];
    private readonly headerName: string;
    private readonly skip?: ETagOptions['skip'];

    constructor(options: ETagOptions = {}) {
        this.enabled = options.enabled ?? true;
        this.weak = options.weak ?? false;
        this.algorithm = options.algorithm;
        this.cacheControl = options.cacheControl;
        this.headerName = options.headerName ?? DEFAULT_HEADER_NAME;
        this.skip = options.skip;
    }

    /**
     * Calcule la valeur d'ETag d'un corps de réponse sérialisé.
     */
    async generate(body: any): Promise<string> {
        const serialized = serialize(body);
        let value: string;
        if (this.algorithm) {
            value = await this.algorithm(serialized);
        } else {
            value = fnv1a(serialized);
        }
        value = `"${value}"`;
        if (this.weak) value = `W/${value}`;
        return value;
    }

    /**
     * Vérifie si la liste d'ETag envoyée par le client (en-tête `If-None-Match`)
     * matche avec l'ETag calculé. Un `*` matche n'importe quelle ressource.
     */
    matches(clientTags: string | null | undefined, tag: string): boolean {
        if (!clientTags) return false;
        const expected = tag.replace(/^W\//, '');
        return clientTags.split(',').some(part => {
            const candidate = part.trim().replace(/^W\//, '');
            return candidate === '*' || candidate === expected;
        });
    }

    /**
     * Applique la politique de cache à en-têtes de réponse.
     */
    applyCacheControl(context: RequestContext): void {
        const cc = this.cacheControl;
        if (!cc) return;

        const directives: string[] = [];
        if (cc === true) {
            directives.push('no-cache');
        } else {
            if (cc.public) directives.push('public');
            else directives.push('private');
            if (cc.maxAge !== undefined) directives.push(`max-age=${cc.maxAge}`);
            if (cc.noCache) directives.push('no-cache');
            if (cc.noStore) directives.push('no-store');
            if (cc.mustRevalidate) directives.push('must-revalidate');
        }
        context.reply.header('Cache-Control', directives.join(', '));
    }

    /**
     * Évalue la requête condititionnelle complète. Si un ETag fort/faible est
     * présent et que le client l'a déjà (via `If-None-Match`), la réponse est
     * marquée `notModified` et doit être envoyée avec le statut `304`.
     */
    async evaluate(context: RequestContext, body: any): Promise<ETagResult> {
        if (!this.enabled || this.skip?.(context, body)) {
            return {tag: '', body, notModified: false};
        }

        const tag = await this.generate(body);
        const header = this.headerName;
        context.reply.header(header, tag);
        this.applyCacheControl(context);

        const ifNoneMatch = context.req.headers.get('if-none-match');
        if (this.matches(ifNoneMatch, tag)) {
            return {tag, body: null, notModified: true};
        }

        return {tag, body, notModified: false};
    }

    /**
     * Raccourci statique, construit une instance à la volée et évalue.
     */
    static async apply(context: RequestContext, body: any, options?: ETagOptions): Promise<ETagResult> {
        return new Etagger(options).evaluate(context, body);
    }
}

/**
 * Instance singulière utilisée par défaut par le middleware `etag()`.
 */
export const defaultEtagger = new Etagger();

/**
 * Middleware ETag prêt à l'emploi. À brancher globalement ou par route :
 *
 * ```typescript
 * app.use(etag({ weak: false, cacheControl: { maxAge: 300 } }))
 * ```
 *
 * Le middleware intercepte `context.reply.send`, calcule l'ETag du corps
 * sérialisé, pose l'en-tête correspondant et répond `304 Not Modified` si le
 * client déclare déjà posséder la représentation (`If-None-Match`).
 */
export function etag(options: ETagOptions = {}) {
    return async ({context, next}: { context: RequestContext; next: () => Promise<any> }) => {
        const reply = context.reply;
        const originalSend = reply.send.bind(reply);
        const etagger = new Etagger(options);

        reply.send = (body: any) => {
            etagger.evaluate(context, body).then(({notModified, body: nextBody}) => {
                if (notModified) {
                    reply.status(HttpStatus.NOT_MODIFIED);
                    originalSend(null);
                    return;
                }
                originalSend(nextBody);
            });
        };

        await next();
    };
}
