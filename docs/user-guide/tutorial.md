# Tutoriel complet

> **Navigation :** [← responses](responses.md) | [plugins →](plugins.md)

Ce tutoriel assemble les briques du guide dans un flux concret:
- configuration du projet
- bootstrap du serveur
- contrôleur
- service
- middleware
- réponse structurée

## 1. Configuration du projet

Créez un fichier `raiton.config.ts` à la racine:

```typescript
export default {
  rootDir: "./source",
  version: "0.10.0",
  port: 5711,
  pathname: "/"
}
```

## 2. Point d’entrée

Dans `source/main.ts`:

```typescript
import "reflect-metadata"
import { ThreadInterface } from "raiton/types"
import { Application } from "raiton/core"
import { RuntimeType } from "raiton/framework"
import { UsersController } from "./controllers/users.controller"

export default async (thread: ThreadInterface) => {
  const app = new Application({
    port: 5711,
    prefix: "/api"
  })

  app.get("/users", () => ({
    statusCode: 200,
    error: false,
    message: "Users retrieved",
    data: []
  }))

  return await thread.setup({
    application: app,
    runtime: RuntimeType.Bun
  }).run()
}
```

## 3. Service métier

Dans `source/services/users.service.ts`:

```typescript
import { Injectable } from "raiton/framework"

@Injectable()
export class UsersService {
  private readonly users = [
    { id: "1", name: "John Doe" },
    { id: "2", name: "Jane Doe" }
  ]

  findAll() {
    return this.users
  }

  findById(id: string) {
    return this.users.find((user) => user.id === id) ?? null
  }
}
```

## 4. Middleware

Dans `source/middleware/auth.middleware.ts`:

```typescript
export async function authMiddleware({ context, next }) {
  const token = context.req.headers.get("authorization")

  if (!token) {
    context.reply.status(401)
    return context.reply.send({
      statusCode: 401,
      error: true,
      message: "Unauthorized",
      data: null
    })
  }

  context.state.user = { id: "1", role: "admin" }
  await next()
}
```

## 5. Contrôleur

Dans `source/controllers/users.controller.ts`:

```typescript
import { Controllable, Get, Inject, Param, Middleware } from "raiton/framework"
import { UsersService } from "../services/users.service"
import { authMiddleware } from "../middleware/auth.middleware"

@Controllable("/users")
@Middleware(authMiddleware)
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService
  ) {}

  @Get("/")
  list() {
    return {
      statusCode: 200,
      error: false,
      message: "Users retrieved",
      data: this.usersService.findAll()
    }
  }

  @Get("/:id")
  getOne(@Param("id") id: string) {
    const user = this.usersService.findById(id)

    if (!user) {
      return {
        statusCode: 404,
        error: true,
        message: "Utilisateur introuvable",
        data: null
      }
    }

    return {
      statusCode: 200,
      error: false,
      message: "User retrieved",
      data: user
    }
  }
}
```

## 6. Démarrer le projet

```bash
bun raiton dev
```

## 7. Résultat attendu

- `GET /api/users` renvoie la liste des utilisateurs
- `GET /api/users/:id` renvoie un utilisateur ou une erreur 404
- les routes du contrôleur sont protégées par un middleware d’authentification

## Ce que montre ce flux

- `source/main.ts` initialise le serveur
- `UsersService` contient la logique métier
- `UsersController` expose l’API
- `authMiddleware` applique une règle transversale
- les réponses restent standardisées

---

[← responses](responses.md) | [plugins →](plugins.md)
