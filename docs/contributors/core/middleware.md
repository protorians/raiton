# Middleware

**Fichiers :** `source/core/middleware/`
**Import :** `import { middlewareCompose, MiddlewarePipeline } from "raiton/core"`

> **Navigation :** [← router.md](router.md) | [↑ core/](README.md) | [controller.md →](controller.md)

## `MiddlewarePipeline`

Pile de middleware exécutés séquentiellement dans l'ordre d'enregistrement (Koa-style).

```typescript
const pipeline = new MiddlewarePipeline()

// Ajouter un middleware
pipeline.use(async ({ context, next }) => {
  console.log("Avant")
  await next()
  console.log("Après")
})

// Exécuter avec un gestionnaire final
await pipeline.run(ctx, finalHandler)
```

### Signature d'un middleware

```typescript
type MiddlewareType = (params: MiddlewareParametersInterface) => any

interface MiddlewareParametersInterface {
  context: RequestContext   // Contexte de la requête en cours
  next: () => Promise<any> // Fonction pour passer au suivant
}
```

**Règle impérative :** un middleware **doit** appeler `await next()` pour passer la main au middleware suivant. Sans cela, la chaîne est interrompue.

## `middlewareCompose`

Fonction de composition Koa-style. Utilisée en interne par `MiddlewarePipeline`.

```typescript
const composed = middlewareCompose([mw1, mw2, mw3])
// Retourne une fonction (ctx) => Promise<any>
await composed(ctx)
```

## Exemples

### Logger de temps d'exécution

```typescript
app.use(async ({ context, next }) => {
  const start = performance.now()
  await next()
  const duration = performance.now() - start
  console.log(`${context.req.method} ${context.req.url} → ${duration.toFixed(2)}ms`)
})
```

### Authentification basique

```typescript
app.use(async ({ context, next }) => {
  const token = context.req.headers.get("authorization")
  if (!token) {
    context.reply.status(401)
    return context.reply.send({ error: "Unauthorized" })
  }
  context.state.user = await verifyToken(token)
  await next()
})
```

### Blocage d'IP

```typescript
app.use(async ({ context, next }) => {
  const ip = getRealIp(context.req)
  if (blockedIps.includes(ip)) {
    context.reply.status(403)
    return context.reply.send({ error: "Forbidden" })
  }
  await next()
})
```

### Middleware sur une route spécifique (via décorateur)

```typescript
import { Controllable, Get, Middleware } from "raiton/framework"

const logger = async ({ context, next }) => {
  console.log(`Route spécifique: ${context.req.url}`)
  await next()
}

@Controllable("/users")
export class UserController {
  @Get("/:id")
  @Middleware(logger) // ← middleware uniquement sur cette route
  getById(@Param("id") id: string) {
    return { id }
  }
}
```

### Middleware sur tout un contrôleur

```typescript
import { Controllable, Get, Middleware } from "raiton/framework"

const auth = async ({ context, next }) => {
  if (!context.req.headers.get("authorization")) {
    context.reply.status(401)
    return
  }
  await next()
}

@Controllable("/admin")
@Middleware(auth) // ← middleware sur toutes les routes du contrôleur
export class AdminController {
  @Get("/dashboard")
  dashboard() {
    return { sensitive: "data" }
  }
}
```

## Ordre d'exécution

Les middlewares sont exécutés dans cet ordre :

1. **bodyParserPlugin** (enregistré automatiquement par `Application.initialize()`) → parse le body
2. **Security.headers** (enregistré automatiquement) → en-têtes de sécurité
3. **Middlewares des plugins** (ordre d'enregistrement)
4. **Middlewares globaux** (`app.use()`)
5. **Middleware du contrôleur** (`@Middleware` sur classe)
6. **Middleware de la route** (`@Middleware` sur méthode)
7. **Handler de la route**

## Pipeline et `RequestContext`

Le `RequestContext` traverse toute la chaîne et peut être enrichi via `context.state` :

```typescript
// Middleware 1 : authentification
app.use(async ({ context, next }) => {
  context.state.user = { id: 1, role: "admin" }
  await next()
})

// Middleware 2 : vérification de rôle
app.use(async ({ context, next }) => {
  if (context.state.user.role !== "admin") {
    context.reply.status(403)
    return
  }
  await next()
})

// Handler
app.get("/admin/data", (ctx) => {
  return { user: ctx.state.user, data: "secret" }
})
```

---

[← router.md](router.md) | [↑ core/](README.md) | [controller.md →](controller.md)
