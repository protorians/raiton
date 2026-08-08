# `@Controllable()`

> **Navigation :** [← README](README.md) | [routes →](routes.md)

`@Controllable()` transforme une classe en contrôleur Raiton et lui associe un préfixe de route.

## Pourquoi utilisé

- regrouper les routes par ressource
- donner une base claire aux chemins du contrôleur
- enregistrer la classe dans le conteneur via `Injectable`

## Comment l’utiliser

- placez le décorateur sur une classe de contrôleur
- passez un préfixe, par exemple `"/users"`
- combinez-le avec `@Get()`, `@Post()` et les décorateurs de paramètres

## Exemple

```typescript
import { Controllable, Get } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/")
  list() {
    return []
  }
}
```

## Avantages

- contrôleurs explicites
- compatible avec l’injection et les routes
- réduit le câblage manuel

## Inconvénients

- impose une structure par classe
- repose sur les métadonnées TypeScript

---

[← README](README.md) | [routes →](routes.md)
