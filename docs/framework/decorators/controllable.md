# Décorateurs de Contrôleurs et Routes

**Fichier :** `source/framework/decorators/controllable.decorator.ts`, `routable.decorator.ts`
**Import :** `import { Controllable, Get, Post, Put, Patch, Delete, Options, Head, Trace } from "raiton/framework"`

> **Navigation :** [← decorators/](README.md) | [↑ decorators/](README.md) | [parametrable.md →](parametrable.md)

## `@Controllable(prefix?)`

Marque une classe comme contrôleur REST. Le préfixe est optionnel.

```typescript
@Controllable("/users")
export class UserController {
  // ...
}
```

**Fonctionnement interne :**
1. Appelle `@Injectable(LifetimeEnum.TRANSIENT, className)` → enregistre le contrôleur dans le DI
2. Crée les métadonnées via `getControllerMetadata(target.prototype)` et définit le préfixe

**Sans préfixe :**

```typescript
@Controllable()
export class HealthController {
  @Get("/health")  // Route : /health
  check() { return "ok" }
}
```

## `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Options`, `@Head`, `@Trace`

Déclarent une route HTTP sur une méthode de contrôleur.

```typescript
@Controllable("/users")
export class UserController {
  @Get("/")                       // GET /users
  list() { return [] }

  @Get("/:id")                    // GET /users/:id
  get(@Param("id") id: string) { return { id } }

  @Post("/")                      // POST /users
  create(@Body() data: any) { return data }

  @Put("/:id")                    // PUT /users/:id
  update(@Param("id") id: string, @Body() data: any) { return { id, ...data } }

  @Patch("/:id")                  // PATCH /users/:id
  patch(@Param("id") id: string, @Body() data: any) { return { id, ...data } }

  @Delete("/:id")                 // DELETE /users/:id
  remove(@Param("id") id: string) { return { deleted: true } }

  @Options("/")                   // OPTIONS /users
  options() { return { methods: ["GET", "POST"] } }

  @Head("/:id")                   // HEAD /users/:id
  head(@Param("id") id: string) { return }

  @Trace("/")                     // TRACE /users
  trace() { return { message: "trace" } }
}
```

## Chemins et paramètres d'URL

Les segments `:param` dans le chemin extraient automatiquement la valeur de l'URL :

```typescript
@Controllable("/api")
export class ApiController {
  @Get("/users/:userId/posts/:postId")
  getPost(
    @Param("userId") userId: string,
    @Param("postId") postId: string,
  ) {
    return { userId, postId }
  }
}
```

## Routes avec version

Le paramètre `version` est supporté via `compileController` → `app.route()` mais pas directement dans les décorateurs de route. Pour versionner :

```typescript
@Controllable("/v1/users")
export class UserV1Controller { /* ... */ }

@Controllable("/v2/users")
export class UserV2Controller { /* ... */ }
```

## Exemple complet

```typescript
import { Controllable, Get, Post, Put, Delete, Param, Body } from "raiton/framework"

interface User {
  id: number
  name: string
  email: string
}

let users: User[] = [{ id: 1, name: "Alice", email: "alice@example.com" }]
let nextId = 2

@Controllable("/users")
export class UserController {
  @Get("/")
  list(): User[] {
    return users
  }

  @Get("/:id")
  get(@Param("id") id: string): User | undefined {
    return users.find(u => u.id === Number(id))
  }

  @Post("/")
  create(@Body() data: Omit<User, "id">): User {
    const user = { id: nextId++, ...data }
    users.push(user)
    return user
  }

  @Put("/:id")
  update(@Param("id") id: string, @Body() data: Partial<User>): User | undefined {
    const index = users.findIndex(u => u.id === Number(id))
    if (index === -1) return undefined
    users[index] = { ...users[index], ...data }
    return users[index]
  }

  @Delete("/:id")
  remove(@Param("id") id: string): { deleted: boolean } {
    const index = users.findIndex(u => u.id === Number(id))
    if (index !== -1) users.splice(index, 1)
    return { deleted: index !== -1 }
  }
}
```

---

[← decorators/](README.md) | [↑ decorators/](README.md) | [parametrable.md →](parametrable.md)
```
