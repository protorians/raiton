import "reflect-metadata";
import {METADATA_KEYS} from "../constants/decorators.constant.ts";
import type {CacheOptions} from "./types.ts";

/**
 * Décorateur de route : met en cache la réponse du handler pendant `ttl`.
 *
 * Contrairement aux ETag (validation), le cache évite complètement l'exécution
 * du handler tant que l'entrée est fraîche.
 *
 * @example
 * @Controllable("/products")
 * class ProductController {
 *   @Get("/featured")
 *   @Cache({ ttl: 60_000, vary: ["accept-language"] })
 *   featured() {
 *     return this.products.findFeatured()
 *   }
 * }
 */
export function Cache(options: CacheOptions = {}) {
    return (target: any, propertyKey?: string) => {
        if (propertyKey) {
            Reflect.defineMetadata(METADATA_KEYS.CACHE, options, target, propertyKey);
        }
    };
}

export function getCacheMetadata(target: any, propertyKey: string): CacheOptions | undefined {
    return Reflect.getMetadata(METADATA_KEYS.CACHE, target, propertyKey);
}

export function isCached(target: any, propertyKey: string): boolean {
    return Reflect.hasMetadata(METADATA_KEYS.CACHE, target, propertyKey);
}
