import type {RequestContext} from "../../core/context.ts";
import type {CacheEntry, CacheOptions, CacheStore} from "./types.ts";

/**
 * Store en mémoire, à durée de vie bornée (TTL) et taille maximale bornée,
 * utilisé par défaut pour la mise en cache des réponses de routes.
 */
export class MemoryCacheStore implements CacheStore {
    private entries = new Map<string, CacheEntry>();
    private readonly maxSize: number;

    constructor(maxSize = 1000) {
        this.maxSize = maxSize;
    }

    get<T = any>(key: string): CacheEntry<T> | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry;
    }

    set<T = any>(key: string, entry: CacheEntry<T>, _ttl?: number): void {
        this.evictIfNeeded();
        this.entries.set(key, entry);
    }

    has(key: string): boolean {
        return this.get(key) !== undefined;
    }

    delete(key: string): boolean {
        return this.entries.delete(key);
    }

    clear(): void {
        this.entries.clear();
    }

    size(): number {
        return this.entries.size;
    }

    private evictIfNeeded(): void {
        if (this.entries.size < this.maxSize) return;
        const oldestKey = this.entries.keys().next().value;
        if (oldestKey !== undefined) this.entries.delete(oldestKey);
    }
}

/**
 * `CacheManager` configure le comportement global du cache de routes, à la
 * manière des autres managers du framework.
 */
export class CacheManager {
    private static _store: CacheStore = new MemoryCacheStore();
    private static _defaults: Partial<CacheOptions> = {};

    static configure(options: Partial<CacheOptions>): void {
        this._defaults = {...this._defaults, ...options};
        if (options.maxEntries && this._store instanceof MemoryCacheStore) {
            this._store = new MemoryCacheStore(options.maxEntries);
        }
    }

    static getDefaults(): Partial<CacheOptions> {
        return {...this._defaults};
    }

    static getStore(): CacheStore {
        return this._store;
    }

    static setStore(store: CacheStore): void {
        this._store = store;
    }

    static clear(): void {
        this._store.clear();
    }
}

const DEFAULT_METHODS = ['GET', 'HEAD'];

/**
 * Construit la clé de cache par défaut : méthode + route + paramètres d'URL.
 */
export function defaultCacheKey(context: RequestContext, route: string): string {
    const parts = [context.req.method, route];
    const params = (context as any).params ?? context.req.params;
    if (params) {
        for (const value of Object.values(params)) {
            parts.push(String(value));
        }
    }
    return parts.join('|');
}

/**
 * Résout les options effectives d'une route (défauts globaux + options locales).
 */
export function resolveCacheOptions(route: string, options: CacheOptions = {}): CacheOptions {
    return {
        ...CacheManager.getDefaults(),
        ...options,
        key: options.key ?? CacheManager.getDefaults().key,
    };
}

/**
 * Calcule la clé de cache pour une requête donnée.
 */
export async function buildCacheKey(context: RequestContext, route: string, options: CacheOptions): Promise<string> {
    const base = options.key
        ? await options.key(context, route)
        : defaultCacheKey(context, route);

    const vary = options.vary ?? [];
    if (vary.length === 0) return base;

    const varyParts = vary.map(name => `${name}=${context.req.headers.get(name) ?? ''}`);
    return `${base}|${varyParts.join('&')}`;
}

/**
 * Applique une réponse en cache au contexte (statut + en-têtes + corps).
 */
export function sendCachedEntry(context: RequestContext, entry: CacheEntry): void {
    context.reply.status(entry.status);
    for (const [name, value] of Object.entries(entry.headers)) {
        context.reply.header(name, value);
    }
    context.reply.send(entry.body);
}

/**
 * Mécanisme cœur du cache de routes, pensé pour être intégré au niveau du
 * handler (dans `createHandler`). Il évite complètement d'exécuter le handler
 * tant qu'une entrée fraîche existe pour la clé de requête.
 *
 * - `get` renvoie l'entrée fraîche si elle existe.
 * - `set` stocke la réponse si elle est éligible (méthode + statut 2xx).
 */
export class RouteCache {
    private readonly store: CacheStore;
    private readonly route: string;
    private readonly options: CacheOptions;

    constructor(route: string, options: CacheOptions = {}) {
        this.route = route;
        this.options = resolveCacheOptions(route, options);
        this.store = CacheManager.getStore();
    }

    get enabled(): boolean {
        return this.options.enabled ?? true;
    }

    matchesMethod(method: string): boolean {
        return (this.options.methods ?? DEFAULT_METHODS).includes(method.toUpperCase());
    }

    key(context: RequestContext): Promise<string> {
        return buildCacheKey(context, this.route, this.options);
    }

    async get<T = any>(context: RequestContext, key?: string): Promise<CacheEntry<T> | undefined> {
        return this.store.get<T>(key ?? await this.key(context));
    }

    async set<T = any>(context: RequestContext, body: T, status = 200, headers: Record<string, string> = {}, key?: string): Promise<void> {
        const ttl = this.options.ttl ?? 60_000;
        this.store.set(key ?? await this.key(context), {
            body,
            status,
            headers,
            createdAt: Date.now(),
            expiresAt: Date.now() + ttl,
        }, ttl);
    }

    shouldCache(status: number): boolean {
        return status >= 200 && status < 300;
    }
}

/**
 * Helper de contrôle-manipulation du cache-Control, valeur commode pour les
 * routes qui ne veulent pas passer par le middleware ETag.
 */
export function cacheControl(context: RequestContext, value: string | number, publicAccess = true): void {
    const directive = typeof value === 'number' ? `max-age=${value}` : value;
    context.reply.header('Cache-Control', `${publicAccess ? 'public' : 'private'}, ${directive}`);
}
