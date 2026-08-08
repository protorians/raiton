# `@ApiBody()`

> **Navigation :** [← api-response](api-response.md) | [api-param →](api-param.md)

`@ApiBody()` décrit le corps d’une requête pour OpenAPI.

## Pourquoi utilisé

- documenter le payload attendu
- clarifier les schémas d’entrée
- compléter la détection automatique quand elle ne suffit pas

## Comment l’utiliser

- placez le décorateur sur une méthode
- passez le type du body, une description et le statut `required`
- combinez-le avec `@Body()` dans la signature du handler

## Exemple

```typescript
import { ApiBody, Body, Controllable, Post } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Post("/")
  @ApiBody({ name: "string" }, "Données du nouvel utilisateur")
  create(@Body() payload: { name: string }) {
    return payload
  }
}
```

## Avantages

- contrats d’entrée plus clairs
- utile pour les DTOs
- améliore la génération OpenAPI

## Inconvénients

- demande de maintenir la doc avec le code
- peut être redondant si les types sont déjà très explicites

---

[← api-response](api-response.md) | [api-param →](api-param.md)
