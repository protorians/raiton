# `@ApiQuery()`

> **Navigation :** [← api-property](api-property.md) | [route-interaction →](route-interaction.md)

`@ApiQuery()` est un raccourci OpenAPI pour décrire un paramètre de query string.

## Pourquoi utilisé

- documenter les filtres et options de recherche
- rendre les requêtes GET plus explicites
- éviter de redécrire manuellement un paramètre `query`

## Comment l’utiliser

- placez le décorateur sur une méthode
- indiquez le nom du paramètre et les options attendues
- associez-le à `@Query()` dans la signature

## Exemple

```typescript
import { ApiQuery, Controllable, Get, Query } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/")
  @ApiQuery("page", { description: "Numéro de page", required: false })
  list(@Query("page") page?: string) {
    return { page }
  }
}
```

## Avantages

- documentation concise
- bon complément à `@Query()`
- utile pour les filtres d’API

## Inconvénients

- purement documentaire
- demande une synchronisation avec le handler

---

[← api-property](api-property.md) | [route-interaction →](route-interaction.md)
