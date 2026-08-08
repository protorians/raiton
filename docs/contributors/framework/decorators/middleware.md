# Décorateur `@Middleware`

**Fichier :** `source/framework/decorators/middleware.decorator.ts`
**Import :** `import { Middleware } from "raiton/framework"`

> **Navigation :** [← injection.md](injection.md) | [↑ decorators/](README.md) | [socket.md →](socket.md)

Attache un middleware à un contrôleur (toutes ses routes) ou à une route spécifique.

```typescript
function Middleware(middleware: MiddlewareCallable)
```

## Signature du middleware

```typescript
type MiddlewareCallable = (params: MiddlewareParametersInterface) => any

interface MiddlewareParametersInterface {
  context: RequestContext
  next: () => Promise<any>
}
```

## `@Middleware` sur une méthode (route spécifique)

```typescript
import { Controllable, Get, Middleware, Param } from "raiton/framework"

const logger = async ({ context, next }: MiddlewareParametersInterface) => {
  console.log(`Avant: ${context.req.url}`)
  await next()
  console.log(`Après: ${context.req.url}`)
}

@Controllable("/users")
export class UserController {
  @Get("/")
  list() {
    return []
  }

  @Get("/:id")
  @Middleware(logger)  // ← middleware uniquement sur cette route
  get(@Param("id") id: string) {
    return { id }
  }
}
```

## `@Middleware` sur une classe (tout le contrôleur)

```typescript
import { Controllable, Get, Post, Middleware, Body } from "raiton/framework"

const auth = async ({ context, next }: MiddlewareParametersInterface) => {
  const token = context.req.headers.get("authorization")
  if (!token) {
    context.reply.status(401)
    return context.reply.send({ error: "Non autorisé" })
  }
  context.state.user = { id: 1, role: "admin" }
  await next()
}

@Controllable("/admin")
@Middleware(auth)  // ← middleware sur TOUTES les routes du contrôleur
export class AdminController {
  @Get("/dashboard")
  dashboard() {
    return { data: "sensible" }
  }

  @Post("/actions")
  action(@Body() data: any) {
    return { success: true, data }
  }
}
```

## Combinaison classe + méthode

Les middlewares de classe s'exécutent avant ceux de méthode.

```typescript
const auth = async ({ context, next }) => {
  context.state.user = { id: 1 }
  await next()
}

const adminOnly = async ({ context, next }) => {
  if (context.state.user.role !== "admin") {
    context.reply.status(403)
    return
  }
  await next()
}

@Controllable("/admin")
@Middleware(auth)  // 1er : authentification
export class AdminController {
  @Get("/")
  list() { return [] }

  @Delete("/:id")
  @Middleware(adminOnly)  // 2e : vérification admin (après auth)
  remove(@Param("id") id: string) {
    return { deleted: true }
  }
}
```

## Ordre d'exécution

```
1. Middlewares globaux (app.use())
2. @Middleware sur la classe du contrôleur
3. @Middleware sur la méthode de la route
4. Handler de la route
```

## Utilisation avec `@Injectable` et injection de dépendances

```typescript
@Injectable(LifetimeEnum.SINGLETON)
class AuthMiddleware {
  async handle({ context, next }: MiddlewareParametersInterface) {
    const token = context.req.headers.get("authorization")
    context.state.user = await this.verify(token)
    await next()
  }

  private async verify(token: string) {
    // Vérification du token...
    return { id: 1 }
  }
}

@Controllable("/protected")
@Middleware(async (params) => {
  const middleware = Injection.resolve(AuthMiddleware)
  return middleware.handle(params)
})
export class ProtectedController {
  @Get("/")
  get() {
    return { secret: true }
  }
}
```

## `createMiddlewareDecoration`

Fonction utilitaire pour créer des décorateurs de middleware personnalisés :

```typescript
import { createMiddlewareDecoration } from "raiton/framework"

const auth = createMiddlewareDecoration(async ({ context, next }) => {
  // ...
})
// auth est utilisable comme @auth
```

---

[← injection.md](injection.md) | [↑ decorators/](README.md) | [socket.md →](socket.md)
