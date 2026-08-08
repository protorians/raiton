# Middleware

> **Navigation :** [← injection](injection.md) | [responses →](responses.md)

Les middlewares permettent d’exécuter une logique avant ou après une route.
Ils servent surtout pour les tâches transverses :
- authentification
- journalisation
- enrichissement du contexte
- contrôle d’accès

## Comment ça marche

Un middleware reçoit:
- `context`, le contexte de la requête
- `next()`, la fonction qui passe au middleware suivant

```typescript
app.use(async ({ context, next }) => {
  console.log(`${context.req.method} ${context.req.url}`)
  await next()
})
```

## Middleware global

Un middleware global s’applique à toutes les routes.

```typescript
app.use(async ({ context, next }) => {
  context.state.startedAt = Date.now()
  await next()
  const duration = Date.now() - context.state.startedAt
  console.log(`Request handled in ${duration}ms`)
})
```

Pourquoi utilisé
- centraliser une règle commune
- éviter de répéter le même code dans plusieurs contrôleurs

Avantages
- simple à brancher
- réutilisable sur toute l’application

Inconvénients
- peut masquer la logique si trop de middlewares sont empilés

## Middleware sur un contrôleur

```typescript
import { Controllable, Get, Middleware } from "raiton/framework"

const auth = async ({ context, next }) => {
  const token = context.req.headers.get("authorization")
  if (!token) {
    context.reply.status(401)
    return context.reply.send({ error: true, message: "Unauthorized" })
  }

  context.state.user = { id: "1", role: "admin" }
  await next()
}

@Controllable("/users")
@Middleware(auth)
export class UsersController {
  @Get("/")
  list() {
    return { ok: true }
  }
}
```

## Middleware sur une route

```typescript
const logger = async ({ context, next }) => {
  console.log(`Route: ${context.req.url}`)
  await next()
}

@Get("/:id")
@Middleware(logger)
getOne(@Param("id") id: string) {
  return { id }
}
```

## Bon usage

- garder les middlewares courts
- réserver la logique métier aux services
- utiliser `context.state` pour partager les données de passage

---

[← injection](injection.md) | [responses →](responses.md)
