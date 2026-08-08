# Décorateurs d'Injection

**Fichier :** `source/framework/decorators/injection.decorator.ts`
**Import :** `import { Injectable, Inject } from "raiton/framework"`

> **Navigation :** [← parametrable.md](parametrable.md) | [↑ decorators/](README.md) | [middleware.md →](middleware.md)

## `@Injectable(lifetime?, name?, scope?)`

Enregistre une classe dans le conteneur DI.

```typescript
import { Injectable } from "raiton/framework"
import { LifetimeEnum } from "@protorians/core"

// Singleton — une seule instance pour toute l'application
@Injectable(LifetimeEnum.SINGLETON)
class DatabaseService {
  connect() { /* ... */ }
}

// Transient — nouvelle instance à chaque injection
@Injectable(LifetimeEnum.TRANSIENT)
class MailService {
  send(email: string) { /* ... */ }
}

// Avec nom personnalisé
@Injectable(LifetimeEnum.SINGLETON, "cache")
class RedisCache {
  get(key: string) { /* ... */ }
}

// Avec scope symbol (isolation)
const adminScope = Symbol("admin")
@Injectable(LifetimeEnum.SINGLETON, "adminConfig", adminScope)
class AdminConfig {
  // Accessible uniquement avec le scope admin
}
```

**Fonctionnement interne :**

```typescript
// Ce que @Injectable(LifetimeEnum.SINGLETON, "db") produit :
const metadata = {
  name: "db",
  construct: DatabaseService,
  lifetime: LifetimeEnum.SINGLETON,
  scope: undefined,
}
Reflect.defineMetadata(METADATA_KEYS.CONTAINER, metadata, target)
Injection.registry("db", DatabaseService, LifetimeEnum.SINGLETON)
```

## `@Inject(token?)`

Injecte une dépendance dans un paramètre du constructeur ou une propriété.

### Injection dans le constructeur

```typescript
@Injectable(LifetimeEnum.TRANSIENT)
class UserService {
  constructor(
    @Inject() private db: DatabaseService,           // Résolution par type
    @Inject("cache") private cache: RedisCache,       // Résolution par nom
    @Inject() private config: AppConfig,
  ) {}
}
```

### Injection dans une propriété

```typescript
@Injectable(LifetimeEnum.TRANSIENT)
class UserController {
  @Inject() private userService!: UserService

  @Inject("cache")
  private cache!: RedisCache
}
```

### Résolution sans argument

Quand `@Inject()` est utilisé sans argument, le type est déduit automatiquement :

- **Constructeur** : via `design:paramtypes` (TypeScript émet le type natif)
- **Propriété** : via `design:type` (nécessite `emitDecoratorMetadata: true`)

```typescript
// Avec emitDecoratorMetadata: true
class UserController {
  constructor(
    @Inject() private db: DatabaseService,  // design:paramtypes[0] = DatabaseService
  ) {}

  @Inject()
  private repo!: UserRepository  // design:type = UserRepository
}
```

## Cycle de vie complet

```typescript
@Injectable(LifetimeEnum.SINGLETON)
class DatabaseService {
  private connection: any

  // Appelé après la création
  onInit() {
    console.log("Initialisation...")
  }

  // Appelé après injection des propriétés
  onMount() {
    this.connection = createConnection()
    console.log("Prêt")
  }

  // Appelé lors de Injection.shutdown()
  async onUnmount() {
    await this.connection.close()
    console.log("Fermé")
  }
}

@Injectable(LifetimeEnum.TRANSIENT)
class UserService {
  constructor(@Inject() private db: DatabaseService) {}

  getUsers() {
    return this.db.query("SELECT * FROM users")
  }
}
```

## Exemple : service + contrôleur

```typescript
import { Injectable, Inject, Controllable, Get, Param } from "raiton/framework"

// Service (singleton)
@Injectable(LifetimeEnum.SINGLETON)
class TodoService {
  private todos = [{ id: 1, title: "Apprendre Raiton" }]
  private nextId = 2

  findAll() { return this.todos }
  findById(id: number) { return this.todos.find(t => t.id === id) }
  create(title: string) {
    const todo = { id: this.nextId++, title }
    this.todos.push(todo)
    return todo
  }
}

// Contrôleur (transient — nouvelle instance par requête)
@Controllable("/todos")
export class TodoController {
  constructor(@Inject() private service: TodoService) {}

  @Get("/")
  list() {
    return this.service.findAll()
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.service.findById(Number(id))
  }
}
```

## Règles importantes

1. **Toujours importer `reflect-metadata`** au point d'entrée de l'application
2. **`emitDecoratorMetadata: true`** requis dans `tsconfig.json` pour l'inférence de type automatique
3. Si l'inférence échoue, utilisez le token explicite : `@Inject("nomDuService")`
4. Le nom par défaut est le nom de la classe en **camelCase** : `DatabaseService` → `databaseService`
5. Les dépendances circulaires sont détectées et lèvent une `Throwable`

---

[← parametrable.md](parametrable.md) | [↑ decorators/](README.md) | [middleware.md →](middleware.md)
