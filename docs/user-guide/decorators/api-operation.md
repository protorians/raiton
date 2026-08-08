# `@ApiOperation()`

> **Navigation :** [← api-tags](api-tags.md) | [api-response →](api-response.md)

`@ApiOperation()` décrit une opération OpenAPI sur une méthode.

## Pourquoi utilisé

- résumer l’intention d’une route
- enrichir la documentation générée
- donner un libellé lisible aux consommateurs de l’API

## Comment l’utiliser

- placez le décorateur sur une méthode
- renseignez `summary`, `description` ou `operationId`
- restez cohérent avec le nom métier de la route

## Exemple

```typescript
import { ApiOperation, Controllable, Get } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/")
  @ApiOperation({ summary: "Liste les utilisateurs" })
  list() {
    return []
  }
}
```

## Avantages

- API plus facile à comprendre
- documentation plus propre
- simple à maintenir

## Inconvénients

- purement documentaire
- peut être redondant si le nom de méthode est déjà clair

---

[← api-tags](api-tags.md) | [api-response →](api-response.md)
