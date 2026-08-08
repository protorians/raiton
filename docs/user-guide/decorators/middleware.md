# `@Middleware()`

> **Navigation :** [← injection](injection.md) | [socket →](socket.md)

`@Middleware()` associe un middleware à un contrôleur ou à une route.

## Pourquoi utilisé

- appliquer une règle transversale sur un ensemble de routes
- protéger un contrôleur sans répéter la même logique
- exécuter un traitement avant le handler principal

## Comment l’utiliser

- passez une fonction middleware à `@Middleware()`
- utilisez-le au niveau de la classe pour couvrir tout le contrôleur
- utilisez-le au niveau d’une méthode pour un cas ciblé

## Exemple

```typescript
import { Controllable, Get, Middleware } from "raiton/framework"

async function auth({ context, next }) {
  const token = context.req.headers.get("authorization")
  if (!token) {
    context.reply.status(401)
    return context.reply.send({ statusCode: 401, error: true, message: "Unauthorized", data: null })
  }
  await next()
}

@Controllable("/users")
@Middleware(auth)
export class UsersController {
  @Get("/")
  list() {
    return []
  }
}
```

## Avantages

- réutilisable
- centralise les règles d’accès ou de log
- garde les handlers centrés sur le métier

## Inconvénients

- peut masquer le flux réel si trop de couches sont empilées
- demande de bien comprendre l’ordre d’exécution

---

[← injection](injection.md) | [socket →](socket.md)
