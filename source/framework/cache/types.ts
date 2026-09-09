import type {RequestContext} from "../../core/context.ts";

/**
 * Options de configuration du système de cache de routes et des ETag.
 */

export type CacheKeyCallable = (context: RequestContext, route?: string) => string | Promise<string>;

export interface ETagOptions {
    /**
     * Active ou désactive la génération d'ETag. (défaut: `true`)
     */
    enabled?: boolean;

    /**
     * Marqueur d'ETag faible (`W/"..."`). Les ETag faibles permettent les réponses
     * équivalentes mais pas identiques octet pour octet. (défaut: `false`)
     */
    weak?: boolean;

    /**
     * Fonction de hachage personnalisée. Reçoit le corps sérialisé et renvoie
     * une chaîne qui servira de valeur d'ETag. (défaut: hachage FNV-1a interne)
     */
    algorithm?: (body: string) => string | Promise<string>;

    /**
     * Ajoute automatiquement un en-tête `Cache-Control` adapté aux ETag.
     * Peut être un booléen ou un objet de contrôle fin. (défaut: `false`)
     */
    cacheControl?: boolean | {
        maxAge?: number;
        public?: boolean;
        noCache?: boolean;
        noStore?: boolean;
        mustRevalidate?: boolean;
    };

    /**
     * Nom de l'en-tête de réponse qui portera la valeur d'ETag. (défaut: `ETag`)
     */
    headerName?: string;

    /**
     * Prédicat permettant d'exclure certaines réponses ou requêtes de la
     * génération d'ETag. Renvoie `true` pour sauter la génération.
     */
    skip?: (context: RequestContext, body: any) => boolean;
}

export interface ETagResult {
    tag: string;
    body: any;
    notModified: boolean;
}

export interface CacheOptions {
    /**
     * Durée de validité en millisecondes. (défaut: `60_000`)
     */
    ttl?: number;

    /**
     * Active ou désactive la mise en cache de la route. (défaut: `true`)
     */
    enabled?: boolean;

    /**
     * Nombre maximum d'entrées du cache en mémoire. (défaut: `1000`)
     */
    maxEntries?: number;

    /**
     * Fonction de calcul de la clé de cache. Reçoit le contexte de requête.
     * (défaut: méthode + URL sans query)
     */
    key?: CacheKeyCallable;

    /**
     * En-têtes de requête dont la valeur doit participer à la construction de
     * la clé de cache (segmentation du cache par acceptation de contenu…).
     */
    vary?: string[];

    /**
     * Ne met en cache que pour certaines méthodes HTTP. (défaut: `['GET', 'HEAD']`)
     */
    methods?: string[];
}

export interface CacheEntry<T = any> {
    body: T;
    status: number;
    headers: Record<string, string>;
    expiresAt: number;
    createdAt: number;
}

export interface CacheStore {
    get<T = any>(key: string): CacheEntry<T> | undefined;

    set<T = any>(key: string, entry: CacheEntry<T>, ttl?: number): void;

    has(key: string): boolean;

    delete(key: string): boolean;

    clear(): void;

    size(): number;
}
