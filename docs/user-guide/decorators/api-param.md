# `@ApiParam()`

> **Navigation :** [← api-body](api-body.md) | [api-property →](api-property.md)

`@ApiParam()` ajoute des métadonnées de paramètre supplémentaires à la documentation OpenAPI.

## Pourquoi utilisé

- décrire précisément un paramètre
- documenter les paramètres de path, query, header ou cookie
- compléter les décorateurs de paramètres applicatifs

## Comment l’utiliser

- placez le décorateur sur une méthode
- donnez le nom du paramètre et sa localisation
- associez-le aux décorateurs `@Param()`, `@Query()` ou `@Headers()`

## Exemple

```typescript
import { ApiParam, Controllable, Get, Param } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/:id")
  @ApiParam("id", { in: "path", required: true, description: "Identifiant utilisateur" })
  getOne(@Param("id") id: string) {
    return { id }
  }
}
```

## Avantages

- documentation plus précise
- utile pour les valeurs de route
- améliore la génération de schéma

## Inconvénients

- ajoute une couche de metadata
- peut faire doublon avec le typage TypeScript

---

[← api-body](api-body.md) | [api-property →](api-property.md)
