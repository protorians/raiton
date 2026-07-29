# Contrôleurs

**Fichiers :** `source/core/controller/`
**Import :** `import { ControllerBuilder, compileController, getControllerMetadata } from "raiton/core"`

> **Navigation :** [← middleware.md](middleware.md) | [↑ core/](README.md) | [injection.md →](injection.md)

## `compileController`

Compile un contrôleur décoré en routes enregistrées dans l'application.

```typescript
compileController(HelloController, app)
// 1. Résout l'instance via Injection.resolve(HelloController)
// 2. Lit les métadonnées du contrôleur (getControllerMetadata)
// 3. Pour chaque route décorée :
//    - Combine le préfixe du contrôleur + chemin de la route
//    - Crée le handler via createHandler
//    - Enregistre dans l'application via app.route()
```

### Fonctionnement interne

```typescript
// Ce qu'il se passe quand vous appelez compileController(HelloController, app) :
const instance = Injection.resolve(HelloController)
const metadata = getControllerMetadata(HelloController.prototype)

for (const route of metadata.routes) {
  app.route(
    route.method,
    `${metadata.prefix}${route.path}`,
    createHandler(instance, route, metadata),
  )
}
```

## `ControllerBuilder`

Scanne et compile tous les contrôleurs d'un répertoire.

```typescript
class ControllerBuilder {
  static scan(source: string): Promise<void>
  static build(options: { filename: string; version: number; timestamp: number }): Promise<void>
}
```

### `ControllerBuilder.scan(directory)`

Parcourt récursivement un dossier et compile tous les contrôleurs trouvés :

```typescript
// Appelé automatiquement par RaitonThread.run()
await ControllerBuilder.scan("./source")
// Parcourt tous les fichiers, détecte les contrôleurs via les métadonnées
// Les compile et enregistre leurs routes dans l'application courante
```

### `ControllerBuilder.build()`

Recompile un seul contrôleur (utilisé par le HMR lors d'un changement de fichier) :

```typescript
// Appelé par le watcher HMR via le signal 'hmr:controller'
await ControllerBuilder.build({
  filename: "./source/controllers/user.controller.ts",
  version: 2,
  timestamp: 1700000000000,
})
```

## `getControllerMetadata`

Accède ou crée les métadonnées d'un contrôleur :

```typescript
import { getControllerMetadata } from "raiton/core"

function getControllerMetadata(target: any): ControllerMetaInterface
```

```typescript
interface ControllerMetaInterface {
  prefix: string                    // Préfixe de route (ex: "/users")
  routes: RouteMetaInterface[]      // Routes déclarées
  middlewares: Record<string, any>  // Middlewares attachés
}
```

## Cycle de vie complet

```typescript
// 1. Définition du contrôleur avec décorateurs
@Controllable("/users")
export class UserController {
  @Get("/:id")
  getUser(@Param("id") id: string) {
    return { id }
  }
}

// 2. Au démarrage, RaitonThread.run() appelle ControllerBuilder.scan()
// 3. Pour chaque contrôleur trouvé, compileController() est appelé
// 4. Injection.resolve() crée une instance (singleton ou transient selon @Injectable)
// 5. Les routes sont enregistrées dans le router de l'application
```

## Détection des fichiers contrôleurs

La fonction utilitaire `isControllerArtifact(filename)` du framework détermine si un fichier est un contrôleur :

```typescript
isControllerArtifact("user.controller.ts")   // true
isControllerArtifact("user.service.ts")      // false

---

[← middleware.md](middleware.md) | [↑ core/](README.md) | [injection.md →](injection.md)
```
