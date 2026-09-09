# Cache de routes — `@Cache()`, `CacheManager`

**Fichiers :** `source/framework/cache/cache.ts`, `source/framework/cache/cache.decorator.ts`
**Import :** `import { Cache, CacheManager, MemoryCacheStore } from "raiton/framework"`

> **Navigation :** [← etag.md](etag.md) | [↑ README](README.md) | [framework/](../README.md)

Le cache de routes évite complètement d'exécuter le handler tant que la réponse
est **fraîche** (dans la fenêtre de TTL). C'est une stratégie d'**expiration**,
à distinguer de la **validation** apportée par les ETag.

## `@Cache(options)` — décorateur de route

```typescript
import { Controllable, Get, Cache } from "raiton/framework"

@Controllable("/products")
export class ProductController {
  @Get("/featured")
  @Cache({ ttl: 60_000 })
  featured() {
    return this.products.findFeatured()
  }
}
```

Le décorateur enregistre un middleware sur la route. Tant que l'entrée est
fraîche, la réponse est servie depuis le store **sans** appeler le handler.
À expiration, le handler s'exécute à nouveau et la réponse est stockée.

## `CacheOptions`

| Option | Type | défaut | Description |
|--------|------|--------|-------------|
| `ttl` | `number` | `60_000` | durée de validité (ms) |
| `enabled` | `boolean` | `true` | active le cache de la route |
| `maxEntries` | `number` | `1000` | taille max du store en mémoire |
| `key` | `(context, route?) => string` | méthode + pathname + params | clé personnalisée |
| `vary` | `string[]` | `[]` | en-têtes participant à la clé (segmentation) |
| `methods` | `string[]` | `['GET', 'HEAD']` | méthodes HTTP mises en cache |

### Segmenter par en-tête

```typescript
@Cache({ ttl: 30_000, vary: ["accept-language"] })
list() { /* ... */ }
```

Deux langues différentes produiront deux entrées de cache distinctes.

## `CacheManager` — configuration globale

Comme les autres managers du framework, `CacheManager` configure le comportement
par défaut et le store partagé.

```typescript
CacheManager.configure({ ttl: 30_000, maxEntries: 5000 })
CacheManager.setStore(redisStore)   // store alternatif, p.ex. Redis
CacheManager.clear()                // vide le cache
```

## `MemoryCacheStore` & `CacheStore`

Le store par défaut est un `MemoryCacheStore` borné (TTL + taille max). Un store
alternatif doit implémenter l'interface `CacheStore` :

```typescript
interface CacheStore {
  get<T>(key: string): CacheEntry<T> | undefined
  set<T>(key: string, entry: CacheEntry<T>, ttl?: number): void
  has(key: string): boolean
  delete(key: string): boolean
  clear(): void
  size(): number
}
```

## Combinaison avec les ETag

Le middleware `etag()` (global) s'exécute avant le middleware `@Cache()` (route).
Sur une réponse servie depuis le cache, l'ETag est calculé sur le corps mis en
cache : le client peut donc **valider** une réponse déjà **fraîche**.

---

[← etag.md](etag.md) | [↑ README](README.md) | [framework/](../README.md)
