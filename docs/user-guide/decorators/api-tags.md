# `@ApiTags()`

> **Navigation :** [← socket](socket.md) | [api-operation →](api-operation.md)

`@ApiTags()` regroupe un contrôleur ou une route sous un ou plusieurs tags OpenAPI.

## Pourquoi utilisé

- classer les routes dans la documentation
- rendre la lecture de l’API plus rapide
- ajouter une description métier aux groupes de routes

## Comment l’utiliser

- placez le décorateur sur une classe ou une méthode
- passez un ou plusieurs tags
- combinez-le avec `@ApiOperation()` et `@ApiResponse()`

## Exemple

```typescript
import { ApiTags, Controllable, Get } from "raiton/framework"

@ApiTags("Users")
@Controllable("/users")
export class UsersController {
  @Get("/")
  list() {
    return []
  }
}
```

## Avantages

- documentation mieux organisée
- classification simple
- compatible avec les générateurs OpenAPI

## Inconvénients

- n’a pas d’effet runtime direct
- peut être oublié si vous documentez après coup

---

[← socket](socket.md) | [api-operation →](api-operation.md)
