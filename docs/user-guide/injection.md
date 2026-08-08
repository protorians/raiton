# Injection et services

> **Navigation :** [← api](api/README.md) | [plugins →](plugins.md)

Le schéma recommandé est de laisser le contrôleur orchestrer la requête, puis de déléguer la logique métier au service.

Cette couche sert souvent à encapsuler les appels vers une base de données, une API externe ou un système de stockage.

```typescript
import { Injectable } from "raiton/framework"

@Injectable()
export class UserService {
  private readonly users = [
    { id: "1", name: "John Doe" },
    { id: "2", name: "Jane Doe" }
  ]

  findAll() {
    return this.users
  }

  findById(id: string) {
    return this.users.find((user) => user.id === id) ?? null
  }

  create(name: string) {
    const user = { id: crypto.randomUUID(), name }
    this.users.push(user)
    return user
  }
}
```

```typescript
import { Controllable, Get, Inject, Param } from "raiton/framework"
import { UserService } from "../services/user.service"

@Controllable("/users")
export class UserController {
  constructor(
    @Inject(UserService) private readonly userService: UserService
  ) {}

  @Get("/")
  list() {
    return this.userService.findAll()
  }

  @Get("/:id")
  getOne(@Param("id") id: string) {
    const user = this.userService.findById(id)
    return user ?? { error: true, statusCode: 404, message: "Utilisateur introuvable" }
  }
}
```

Utilisez cette approche pour séparer clairement :
- les contrôleurs
- la logique métier
- la persistance

## Pourquoi c’est utile

- les tests ciblent le service sans démarrer tout le serveur
- les contrôleurs restent minces
- les règles métier deviennent réutilisables

## Convention de nommage

Une convention fréquente consiste à nommer les services par domaine et par rôle :
- `UsersService`
- `UsersRepository`
- `UsersController`

Cette convention aide à identifier rapidement le domaine et le rôle du service.

---

[← api](api/README.md) | [plugins →](plugins.md)
