# Injection de Dépendances

**Fichier :** `source/core/injection/injection.ts`
**Import :** `import { Injection } from "raiton/core"`

> **Navigation :** [← controller.md](controller.md) | [↑ core/](README.md) | [plugin-scope.md →](plugin-scope.md)

Conteneur DI complet avec support singleton, transient, détection de dépendances circulaires et cycle de vie.

## Concepts

### Scopes de cycle de vie (`LifetimeEnum` de `@protorians/core`)

| Scope | Comportement |
|-------|-------------|
| `SINGLETON` | Une seule instance par scope (`Symbol`). Réutilisée à chaque résolution. |
| `TRANSIENT` | Nouvelle instance à chaque résolution. |

## Méthodes statiques

### `Injection.registry(name, construct, lifetime?, scope?)`

Enregistrer une classe dans le conteneur :

```typescript
import { Injection } from "raiton/core"
import { LifetimeEnum } from "@protorians/core"

// Singleton (par défaut)
Injection.registry("database", DatabaseService, LifetimeEnum.SINGLETON)

// Transient — nouvelle instance à chaque fois
Injection.registry("mailer", MailService, LifetimeEnum.TRANSIENT)

// Avec scope personnalisé
const adminScope = Symbol("admin")
Injection.registry("config", AppConfig, LifetimeEnum.SINGLETON, adminScope)
```

### `Injection.get(name, scope?)`

Résoudre une dépendance :

```typescript
const db = Injection.get<DatabaseService>("database")
const config = Injection.get<AppConfig>("config", adminScope)
```

### `Injection.has(name)`

Vérifier si une dépendance est enregistrée :

```typescript
if (Injection.has("database")) {
  const db = Injection.get("database")
}
```

### `Injection.resolve(construct)`

Résoudre une dépendance à partir du constructeur (utilise les métadonnées `@Injectable`) :

```typescript
const controller = Injection.resolve(UserController)
```

### `Injection.clear()`

Vider le conteneur :

```typescript
Injection.clear() // Vide classes, instances, dépendants et chemins d'artifacts
```

### `Injection.shutdown()`

Arrêter le conteneur : appelle `onUnmount()` sur toutes les instances, puis `clear()`.

```typescript
await Injection.shutdown()
```

## Décorateurs

### `@Injectable(lifetime?, name?, scope?)`

Enregistre automatiquement une classe dans le conteneur DI :

```typescript
import { Injectable } from "raiton/framework"
import { LifetimeEnum } from "@protorians/core"

@Injectable(LifetimeEnum.SINGLETON, "myService")
class MyService {
  getData() { return "data" }
}

// Équivalent à :
Injection.registry("myService", MyService, LifetimeEnum.SINGLETON)
```

Si `name` est omis, le nom de la classe est utilisé (en camelCase).

### `@Inject(token?)`

Injecte une dépendance dans un paramètre du constructeur ou une propriété :

```typescript
// Injection dans le constructeur
class UserService {
  constructor(
    @Inject() private db: DatabaseService,
    @Inject("config") private config: AppConfig,
  ) {}
}

// Injection dans une propriété
class UserController {
  @Inject() private userService!: UserService
}
```

**Comportement :**
- Sans argument (`@Inject()`) : le type est déduit de `design:paramtypes` (constructeur) ou `design:type` (propriété).
- Avec argument (`@Inject("name")`) : résout par le nom donné.

## Résolution des dépendances

### Ordre de résolution des arguments

```typescript
class MyService {
  constructor(
    @Inject() private db: DatabaseService,  // 1. Token explicite via métadonnée
    private config: AppConfig,              // 2. design:paramtypes
    private flag: boolean,                  // 3. undefined si non trouvé
  ) {}
}
```

### Détection des dépendances circulaires

```typescript
class A { constructor(@Inject() private b: B) {} }
class B { constructor(@Inject() private a: A) {} }

Injection.get("a")
// → Throwable: "Circular dependency detected: a -> b -> a"
```

## Cycle de vie des instances

Si une instance possède ces méthodes, elles sont automatiquement appelées :

| Méthode | Moment d'appel |
|---------|---------------|
| `onInit()` | Après création de l'instance (avant `onMount`) |
| `onMount()` | Après injection des propriétés |
| `onUnmount()` | Lors de `Injection.shutdown()` |

```typescript
@Injectable(LifetimeEnum.SINGLETON)
class DatabaseService {
  private connection: any

  onInit() {
    console.log("DatabaseService initialisé")
  }

  onMount() {
    this.connection = createConnection()
  }

  async onUnmount() {
    await this.connection.close()
    console.log("DatabaseService fermé")
  }
}
```

## Exemple complet

```typescript
import "reflect-metadata"
import { Injectable, Inject, Controllable, Get } from "raiton/framework"

// 1. Service — Singleton
@Injectable(LifetimeEnum.SINGLETON)
class UserRepository {
  private users = [{ id: 1, name: "Alice" }]

  findAll() { return this.users }
  findById(id: number) { return this.users.find(u => u.id === id) }
}

// 2. Contrôleur avec injection
@Controllable("/users")
export class UserController {
  constructor(
    @Inject() private repo: UserRepository
  ) {}

  @Get("/")
  list() {
    return this.repo.findAll()
  }

  @Get("/:id")
  get(@Param("id") id: string) {
    return this.repo.findById(Number(id))
  }
}
```

## Méthodes internes avancées

| Méthode | Usage |
|---------|-------|
| `updateConstruct(name, construct)` | Met à jour le constructeur d'une entrée (HMR) |
| `getDependents(name)` | Liste les dépendants directs d'une entrée |
| `registerArtifactPath(name, path)` | Enregistre le chemin d'un artifact |
| `getArtifactPath(name)` | Récupère le chemin d'un artifact |

---

[← controller.md](controller.md) | [↑ core/](README.md) | [plugin-scope.md →](plugin-scope.md)
