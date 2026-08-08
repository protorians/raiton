# `@ApiResponse()`

> **Navigation :** [← api-operation](api-operation.md) | [api-body →](api-body.md)

`@ApiResponse()` déclare les réponses OpenAPI d’une route.

## Pourquoi utilisé

- documenter les statuts possibles d’un endpoint
- décrire les schémas de retour
- rendre les erreurs attendues visibles dans OpenAPI

## Comment l’utiliser

- placez le décorateur sur une méthode
- indiquez un `status` et une description
- utilisez les raccourcis comme `@ApiOkResponse()` ou `@ApiNotFoundResponse()`

## Exemple

```typescript
import { ApiOkResponse, ApiNotFoundResponse, Controllable, Get } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/:id")
  @ApiOkResponse("Utilisateur trouvé")
  @ApiNotFoundResponse("Utilisateur introuvable")
  getOne() {
    return null
  }
}
```

## Avantages

- documentation de sortie plus fiable
- meilleure lisibilité des cas d’erreur
- compatible avec les outils OpenAPI

## Inconvénients

- n’implémente pas la validation elle-même
- peut dupliquer les statuts déjà gérés dans le code

---

[← api-operation](api-operation.md) | [api-body →](api-body.md)
