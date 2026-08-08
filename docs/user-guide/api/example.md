# Exemple complet d’API

> **Navigation :** [← responses](responses.md) | [← README](README.md)

Ce fichier assemble les briques essentielles pour créer une ressource simple.

## Exemple

```typescript
import { Controllable, Get, Post, Body, Param } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/")
  list() {
    return {
      items: [{ id: "1", name: "John Doe" }],
      total: 1
    }
  }

  @Get("/:id")
  getOne(@Param("id") id: string) {
    return { id, name: "John Doe" }
  }

  @Post("/")
  create(@Body() payload: { name: string }) {
    return {
      id: crypto.randomUUID(),
      name: payload.name
    }
  }
}
```

## Ce que montre cet exemple

- une ressource `users`
- une lecture par identifiant
- une création simple avec corps JSON

## Bon réflexe

- gardez la logique métier dans un service
- laissez le contrôleur exposer uniquement l’API

---

[← responses](responses.md) | [← README](README.md)
