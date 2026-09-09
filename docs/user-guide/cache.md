# Cache & ETag

> **Navigation :** [← security](security.md) | [health-check →](health-check.md)

Raiton fournit deux mécanismes de performance HTTP complémentaires :

- **ETag** (validation) : le client valide sa copie et reçoit `304 Not Modified`.
- **Cache de routes** (expiration) : le handler n'est pas ré-exécuté tant que
  la réponse est fraîche.

## ETag — validation avec `etag()`

Branchez le middleware `etag()` sur votre application. Il calcule un ETag de
chaque réponse, pose l'en-tête `ETag` et répond `304` si le client le possède
déjà (`If-None-Match`).

```typescript
import { Application } from "raiton/core"
import { etag } from "raiton/framework"

const app = new Application({ port: 3000 })

app.use(etag({
  weak: false,
  cacheControl: { maxAge: 60, public: true },
}))
```

### Personnaliser

`etag()` accepte un algorithme de hachage, le marqueur faible, le nom d'en-tête
et un prédicat d'exclusion :

```typescript
app.use(etag({
  weak: true,
  algorithm: async (body) =>
    crypto.createHash("sha1").update(body).digest("hex"),
  skip: (ctx) => ctx.req.method !== "GET",
}))
```

## Cache de routes — `@Cache()`

Mettez en cache la réponse d'une route pendant un `ttl` sans ré-exécuter le
handler :

```typescript
import { Controllable, Get, Cache } from "raiton/framework"

@Controllable("/products")
export class ProductController {
  @Get("/featured")
  @Cache({ ttl: 60_000, vary: ["accept-language"] })
  featured() {
    return this.catalogue.featured()
  }
}
```

Configurez globalement les défauts et le store :

```typescript
import { CacheManager } from "raiton/framework"

CacheManager.configure({ ttl: 30_000, maxEntries: 5000 })
```

## Les deux ensemble

Un `@Cache()` global (ou par route) réduit le travail du handler, et un `etag()`
en amont permet au client de valider sa copie — y compris les réponses servies
depuis le cache.

> Pour le détail de toutes les options : voir le [décorateur `@Cache`](decorators/cache.md).

---

[← security](security.md) | [health-check →](health-check.md)
