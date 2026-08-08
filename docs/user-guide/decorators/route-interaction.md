# `@RouteInteraction()`

> **Navigation :** [← api-query](api-query.md) | [guard →](guard.md)

`@RouteInteraction()` associe une description textuelle à une route.

## Pourquoi utilisé

- décrire le sens métier d’une route
- enrichir l’inspection interne et certaines sorties de métadonnées
- garder une trace lisible du flux applicatif

## Comment l’utiliser

- placez le décorateur sur une méthode de route
- utilisez des placeholders comme `[user.firstname]`
- laissez le moteur résoudre la chaîne avec le contexte

## Exemple

```typescript
import { Controllable, Get, RouteInteraction } from "raiton/framework"

@Controllable("/auth")
export class AuthController {
  @Get("/sign-in")
  @RouteInteraction("[user.firstname] est désormais connecté")
  signIn() {
    return { ok: true }
  }
}
```

## Avantages

- description métier explicite
- utile pour l’inspection
- très lisible dans les cas d’usage métier

## Inconvénients

- n’influence pas la logique HTTP
- surtout utile si vous exploitez ces métadonnées

---

[← api-query](api-query.md) | [guard →](guard.md)
