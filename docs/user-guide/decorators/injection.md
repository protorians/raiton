# `@Injectable()` et `@Inject()`

> **Navigation :** [← parameters](parameters.md) | [middleware →](middleware.md)

Ces deux décorateurs gèrent l’injection de dépendances dans Raiton.

## Pourquoi utilisé

- séparer la logique métier du transport HTTP
- réutiliser des services dans plusieurs contrôleurs
- déclarer clairement ce qui doit être instancié par le conteneur

## Comment l’utiliser

- marquez une classe avec `@Injectable()`
- injectez-la dans un constructeur ou une propriété avec `@Inject()`
- privilégiez l’injection par constructeur pour les dépendances obligatoires

## Exemple

```typescript
import { Controllable, Get, Injectable, Inject } from "raiton/framework"

@Injectable()
class UsersService {
  findAll() {
    return []
  }
}

@Controllable("/users")
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get("/")
  list() {
    return this.usersService.findAll()
  }
}
```

## Avantages

- architecture plus nette
- testabilité améliorée
- découplage entre couches

## Inconvénients

- demande une discipline sur les tokens et les classes
- peut devenir opaque si trop de dépendances sont injectées

---

[← parameters](parameters.md) | [middleware →](middleware.md)
