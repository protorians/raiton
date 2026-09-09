# `@Cache()`

> **Navigation :** [← middleware](middleware.md) | [health-check →](health-check.md)

`@Cache()` met en cache la réponse d'une route pendant une durée de vie (`ttl`).
Tant qu'une entrée est fraîche, le handler **n'est pas re-exécuté** : la réponse
est servie depuis le cache.

## Pourquoi l'utiliser

- alléger des endpoints coûteux (lectures DB, calculs, appels externes)
- réduire la latence perçue sur les données peu volatiles
- économiser les ressources serveur sur les pics de lecture

## Comment l'utiliser

- placez `@Cache(options)` sur la méthode d'un contrôleur, après le décorateur de route
- définissez un `ttl` adapté à la volatilité de vos données
- segmentez éventuellement le cache avec `vary`

## Exemple

```typescript
import { Controllable, Get, Cache } from "raiton/framework"

@Controllable("/products")
export class ProductController {
  @Get("/featured")
  @Cache({ ttl: 60_000 })
  featured() {
    // coûteux : n'est exécuté qu'une fois par minute
    return this.catalogue.featured()
  }
}
```

## Options

| Option | Type | défaut | Description |
|--------|------|--------|-------------|
| `ttl` | `number` | `60000` | durée de validité (ms) |
| `enabled` | `boolean` | `true` | désactiver le cache de la route |
| `key` | `(context, route?) => string` | auto | clé personnalisée |
| `vary` | `string[]` | `[]` | en-têtes participant à la clé |
| `methods` | `string[]` | `['GET', 'HEAD']` | méthodes mises en cache |

### Exemple avec `vary`

```typescript
@Get("/")
@Cache({ ttl: 30_000, vary: ["accept-language"] })
list() { /* ... */ }
```

## Configuration globale

Utilisez `CacheManager` pour les réglages par défaut ou un store alternatif.

```typescript
import { CacheManager } from "raiton/framework"

CacheManager.configure({ ttl: 30_000, maxEntries: 5000 })
```

## Avantages

- simple : un décorateur, aucun code de cache à écrire
- personnalisable (TTL, clé, vary, store)
- se combine avec les ETag pour la validation

## Inconvénients

- un `ttl` trop long peut servir des données obsolètes
- le cache est en mémoire par défaut (non partagé entre processus)
- à n'utiliser que sur des données compatibles avec un léger retard

---

[← middleware](middleware.md) | [health-check →](health-check.md)
