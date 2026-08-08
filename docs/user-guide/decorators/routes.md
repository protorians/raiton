# Décorateurs de route

> **Navigation :** [← controllable](controllable.md) | [parameters →](parameters.md)

Les décorateurs de route définissent les verbes HTTP et le chemin associé à une méthode.

## Décorateurs concernés

- `@Get()`
- `@Post()`
- `@Put()`
- `@Patch()`
- `@Delete()`
- `@Options()`
- `@Head()`
- `@Trace()`

## Pourquoi utilisé

- garder le code proche du comportement HTTP
- expliciter les verbes supportés
- éviter de configurer les routes à la main

## Comment l’utiliser

- placez le décorateur sur une méthode publique
- donnez un chemin relatif, par exemple `"/:id"`
- combinez-le avec `@Controllable("/users")`

## Exemple

```typescript
import { Controllable, Get, Post } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/")
  list() {
    return []
  }

  @Post("/")
  create() {
    return { ok: true }
  }
}
```

## Avantages

- lisible
- très proche du HTTP
- simple à maintenir

## Inconvénients

- multiplie les méthodes sur un même contrôleur
- dépend d’une bonne convention de nommage

---

[← controllable](controllable.md) | [parameters →](parameters.md)
