# Classes de Base

**Fichiers :** `source/framework/`
**Import :** `import { DataTransferObject, ViewModel, DelegateController, DelegateService, DelegateRepository, ParameterBag, Artifacts } from "raiton/framework"`

> **Navigation :** [← env.md](env.md) | [↑ framework/](README.md) | [decorators/ →](decorators/README.md)

## `DataTransferObject` (DTO)

**Fichier :** `source/framework/data-transfer-object.ts`

Classe de base pour la validation des données entrantes. Utilise `class-validator`.

```typescript
import { DataTransferObject } from "raiton/framework"
import { IsString, IsEmail, IsNotEmpty, IsNumber, Min, Max } from "class-validator"

class CreateUserDto extends DataTransferObject {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsEmail()
  email!: string

  @IsNumber()
  @Min(18)
  age!: number
}

class UpdateUserDto extends DataTransferObject {
  @IsString()
  name?: string

  @IsEmail()
  email?: string
}
```

### Utilisation dans un contrôleur

```typescript
@Controllable("/users")
export class UserController {
  @Post("/")
  create(@Body() data: CreateUserDto) {
    // data est automatiquement validé avant l'exécution
    // Si invalide → erreur de validation
    return { success: true, data }
  }
}
```

## `ViewModel`

**Fichier :** `source/framework/view-model.ts`

Classe de base pour les modèles de vue (formatage des réponses).

```typescript
import { ViewModel } from "raiton/framework"

class UserViewModel extends ViewModel {
  constructor(private user: any) {
    super()
  }

  toJSON() {
    return {
      id: this.user.id,
      name: this.user.name,
      email: this.user.email,
      createdAt: this.user.created_at,
    }
  }
}

// Utilisation
@Controllable("/users")
export class UserController {
  @Get("/:id")
  get(@Param("id") id: string) {
    const user = { id: 1, name: "Alice", email: "alice@test.com", password: "secret" }
    return new UserViewModel(user)  // Le mot de passe est exclu
  }
}
```

## `DelegateController`

**Fichier :** `source/framework/controllers.ts`

Classe de base vide pour les contrôleurs. Actuellement sans fonctionnalité ajoutée.

```typescript
import { DelegateController } from "raiton/framework"

export class HealthController extends DelegateController {
  // Méthodes spécifiques
}
```

## `DelegateService`

**Fichier :** `source/framework/services.ts`

Classe de base pour les services métier. Fournit `this.repository` pour l'accès aux données.

```typescript
import { DelegateService, DelegateRepository, Injectable } from "raiton/framework"

class UserRepository extends DelegateRepository {
  findAll() { return [] }
  findById(id: number) { return { id } }
}

@Injectable(LifetimeEnum.SINGLETON)
class UserService extends DelegateService {
  constructor() {
    super()
    this.repository = UserRepository  // ou une instance
  }

  getUsers() {
    return this.repository.findAll()
  }
}
```

## `DelegateRepository`

**Fichier :** `source/framework/repositories.ts`

Classe de base pour les repositories. Vérifie que le modèle est valide avant les opérations.

```typescript
import { DelegateRepository } from "raiton/framework"

class UserRepository extends DelegateRepository {
  // this.model est disponible après initialisation
}
```

## `ParameterBag`

**Fichier :** `source/framework/parameter-bag.ts`

Conteneur typé pour des paramètres dynamiques avec accès sécurisé.

```typescript
import { ParameterBag } from "raiton/framework"

const bag = new ParameterBag()

// Définir des valeurs
bag.set("name", "Alice")
bag.set("count", 42)
bag.set("active", true)

// Lire des valeurs
bag.get("name")       // "Alice"
bag.get("missing")    // undefined
bag.get("count")      // 42

// Itérer
bag.forEach((key, value) => console.log(key, value))

// Vider
bag.clear()
```

## `Artifacts`

**Fichier :** `source/framework/artifacts.ts`

Registre des types d'artifacts avec support HMR.

```typescript
import { Artifacts } from "raiton/framework"

// Types par défaut
Artifacts.defaultTypes  // ["controller", "socket", "service"]

// Enregistrer des types supplémentaires
Artifacts.registerMany("command", "event")

// Vérifier si un fichier est un artifact
Artifacts.is("user.controller.ts")  // true (contient "controller")
Artifacts.is("user.service.ts")     // true
Artifacts.is("README.md")           // false

// Recharger un artifact (HMR)
Artifacts.reload(importedModule, filename)
```

### Fonctions utilitaires associées

```typescript
import {
  isControllerArtifact,
  isSocketArtifact,
  isServiceArtifact,
  isArtifact,
} from "raiton/framework"

isControllerArtifact("user.controller.ts")   // true
isSocketArtifact("chat.socket.ts")            // true
isServiceArtifact("auth.service.ts")          // true
isArtifact("user.controller.ts")              // true (n'importe quel type)
```

---

[← env.md](env.md) | [↑ framework/](README.md) | [decorators/ →](decorators/README.md)
