# Système de Plugins

**Fichiers :** `source/core/plugins/`
**Import :** `import { definePlugin, PluginScope } from "raiton/core"`

> **Navigation :** [← injection.md](injection.md) | [↑ core/](README.md) | [config.md →](config.md)

## `PluginScope`

Chaque plugin reçoit un `PluginScope` qui lui donne accès isolé au routeur, au middleware et aux hooks. Les scopes enfants partagent leur parent. Voir `source/core/plugins/scope.ts`.

```typescript
class PluginScope {
  hooks: HookStore           // Hooks partagés avec le parent
  middleware: MiddlewarePipeline  // Pipeline partagé avec le parent
  router: Router             // Routeur partagé avec le parent
}
```

### Méthodes

| Méthode | Description |
|---------|-------------|
| `use(mw)` | Ajoute un middleware. Si l'objet a une méthode `setup` avec 1 paramètre, il est traité comme un plugin. |
| `route(method, path, handler, version?)` | Ajoute une route |
| `get/post/put/patch/delete/options/head/trace(path, handler, version?)` | Raccourcis de routage |
| `register(plugin)` | Enregistre un sous-plugin dans un scope enfant |
| `addHook(name, fn)` | Ajoute un hook de cycle de vie |

### Fonctionnement de `register()` et `use()`

```typescript
// Dans PluginScope :

register(plugin) {
  // Si plugin.setup est une fonction à 1 paramètre :
  const child = new PluginScope(this)  // Scope enfant
  plugin.setup(child)                   // Le plugin reçoit son scope isolé
}

use(mw) {
  // Si l'objet a setup() à 1 paramètre → traité comme plugin
  if (typeof mw === 'object' && 'setup' in mw && mw.setup.length === 1) {
    mw.setup(this)  // Middleware enregistré directement
    return
  }
  // Sinon → middleware standard
  this.middleware.use(mw)
}
```

**Règle :** un plugin a `setup(scope: PluginScope)` avec **1 paramètre**. Un middleware standard reçoit `({context, next})`.

### Propagation parent-enfant

```typescript
const parent = new PluginScope()        // hooks, middleware, router → nouveaux
const child = new PluginScope(parent)   // hooks, middleware, router → ceux du parent
```

Les scopes enfants **partagent** les mêmes références que le parent. Un middleware ajouté dans l'enfant est aussi visible du parent et vice-versa.

## `definePlugin`

Fonction utilitaire pour créer un plugin :

```typescript
import { definePlugin } from "raiton/core"

const monPlugin = definePlugin((scope) => {
  scope.get("/status", () => ({ status: "ok" }))
}, "status-plugin")
```

## Exemples

### Plugin de télémétrie

```typescript
const telemetryPlugin = {
  name: "telemetry",
  setup(scope: PluginScope) {
    scope.use(async ({ context, next }) => {
      const start = Date.now()
      await next()
      const duration = Date.now() - start
      console.log(`${context.req.method} ${context.req.url} ${duration}ms`)
    })
  },
}

app.register(telemetryPlugin)
```

### Plugin avec routes

```typescript
const healthPlugin = {
  name: "health",
  setup(scope: PluginScope) {
    scope.get("/health", () => ({ status: "ok", uptime: process.uptime() }))
    scope.get("/health/db", async () => {
      const db = Injection.get<DatabaseService>("database")
      return { db: await db.ping() }
    })
  },
}

app.register(healthPlugin)
```

### Plugin avec hooks

```typescript
const maintenancePlugin = {
  name: "maintenance",
  setup(scope: PluginScope) {
    scope.addHook("onRequest", (ctx) => {
      if (isMaintenanceMode()) {
        ctx.reply.status(503)
        ctx.reply.send({ error: "Maintenance en cours" })
        // Ne pas appeler next() → bloque la requête
      }
    })
  },
}
```

### Sous-plugin dans un scope enfant

```typescript
const parentPlugin = {
  name: "parent",
  setup(scope: PluginScope) {
    scope.get("/parent", () => "parent")

    // Sous-plugin isolé
    scope.register({
      name: "child",
      setup(childScope: PluginScope) {
        childScope.get("/child", () => "child")
      },
    })
  },
}
```

### Composition de plusieurs plugins

```typescript
app
  .register(bodyParserPlugin())      // Plugin intégré
  .register(healthPlugin)            // Plugin perso
  .register(openApiPlugin({          // Plugin OpenAPI
    title: "Mon API",
    endpoint: "/docs/json",
  }))
  .use(monMiddleware)                // Middleware global
```

## Différence entre `register()` et `use()`

| Méthode | Usage | Comportement |
|---------|-------|-------------|
| `register(plugin)` | Plugin avec `setup(scope)` | Crée un scope enfant isolé |
| `use(plugin)` | Plugin avec `setup(scope)` (à 1 paramètre) | Utilise le scope courant |
| `use(mw)` | Middleware standard `({context, next})` | Ajoute à la pile |

---

[← injection.md](injection.md) | [↑ core/](README.md) | [config.md →](config.md)
