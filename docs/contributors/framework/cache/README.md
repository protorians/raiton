# Module Cache & ETag

**Fichiers :** `source/framework/cache/`
**Import :** `import { Cache, etag, Etagger, CacheManager } from "raiton/framework"`

> **Navigation :** [← framework/](../README.md) | [↑ framework/](../README.md) | [etag.md →](etag.md)

Le module `cache/` regroupe deux mécanismes complémentaires de performance HTTP :
les **ETag** (validation) et le **cache de routes** (expiration).

## Table des matières

| Fichier | Description |
|---------|-------------|
| [etag.md](etag.md) | Gestion complète et personnalisable des ETag |
| [cache.md](cache.md) | Cache de réponses sur les routes via décorateur |

## Vue d'ensemble des exports

```text
cache/
├── index.ts            → Réexporte le module
├── types.ts            → Options ETag & Cache
├── etag.ts             → Etagger (manager) + etag() (middleware)
├── cache.ts            → MemoryCacheStore + CacheManager + createCacheMiddleware
└── cache.decorator.ts  → @Cache (décorateur de route)
```

## Les deux stratégies

| Mécanisme | Objectif | Déclencheur | Coût du handler |
|-----------|----------|-------------|-----------------|
| `etag()` / `Etagger` | Validation (`304 Not Modified`) | En-tête `If-None-Match` | Exécuté |
| `@Cache()` | Expiration (« fresh », pas d'exécution) | TTL | Évité |

Les deux mécanismes s'empilent : un `@Cache()` réduit le travail du handler,
tandis qu'un `etag()` en amont (global) permet au client de valider sa copie.

## Activation

L'ETag et le cache **ne sont pas activés par défaut** — contrairement aux
en-têtes de sécurité — afin de ne pas modifier le comportement des applications
existantes. Le développeur les branche explicitement.

```typescript
import { etag } from "raiton/framework"

const app = new Application({ port: 3000 })

app.use(etag({ weak: false, cacheControl: { maxAge: 60 } }))
```

---

[← framework/](../README.md) | [↑ framework/](../README.md) | [etag.md →](etag.md)
