# Routes d’API

> **Navigation :** [← README](README.md) | [responses →](responses.md)

Raiton décrit les routes dans des classes de contrôleur avec `@Controllable()` et les décorateurs HTTP.

## Pourquoi utilisé

- regrouper les routes par domaine métier
- garder le code proche de l’intention HTTP
- simplifier le câblage du serveur

## Comment l’utiliser

- créez un contrôleur avec `@Controllable("/users")`
- ajoutez `@Get()`, `@Post()`, `@Put()`, `@Patch()` ou `@Delete()`
- utilisez les décorateurs de paramètres pour extraire les données d’entrée

## Exemple

```typescript
import { Controllable, Get, Post, Param, Body } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/")
  list() {
    return []
  }

  @Get("/:id")
  getOne(@Param("id") id: string) {
    return { id }
  }

  @Post("/")
  create(@Body() payload: { name: string }) {
    return payload
  }
}
```

## Avantages

- lisible
- aligné sur le vocabulaire HTTP
- facile à faire évoluer

## Inconvénients

- nécessite une convention de structure
- peut devenir volumineux si un contrôleur gère trop d’actions

---

[← README](README.md) | [responses →](responses.md)
