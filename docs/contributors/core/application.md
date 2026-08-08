# `Application`

**Fichier :** `source/core/application.ts`
**Import :** `import { Application } from "raiton/core"`

> **Navigation :** [← core/](README.md) | [↑ core/](README.md) | [router.md →](router.md)

La classe `Application` est le point d'entrée principal pour configurer et exécuter votre application HTTP.

## Constructeur

```typescript
const app = new Application({
  port: 3000,            // Port d'écoute (défaut: 5712)
  hostname: "0.0.0.0",   // Hôte (défaut: "localhost")
  protocole: "http",      // Protocole (défaut: "http")
  pathname: "/",          // Chemin racine
  prefix: "/api",         // Préfixe global des routes
  develop: false,         // Mode développement (stack traces)
  verbose: false,         // Logs détaillés
  workdir: process.cwd(), // Répertoire de travail
})
```

## Propriétés

| Propriété | Type | Description |
|-----------|------|-------------|
| `config` | `ApplicationConfigInterface` | Configuration fournie au constructeur |
| `version` | `string` | Version depuis `RaitonConfig` ou `"0.0.1"` |
| `hostname` | `string` (getter) | URL complète calculée (`http://localhost:3000/`) |

## Méthodes

### `setOption(key, value)` / `setOptions(options)`

Modifier la configuration après instanciation :

```typescript
app.setOption("port", 4000)
app.setOptions({ port: 4000, verbose: true })
```

### `register(plugin)`

Enregistrer un plugin :

```typescript
app.register(monPlugin)
app.register({ name: "mon-plugin", setup: (scope) => { /* ... */ } })
```

Un plugin est un objet avec une méthode `setup(scope: PluginScope)`. Voir [plugin-scope.md](plugin-scope.md).

### `use(mw)`

Ajouter un middleware global :

```typescript
app.use(async ({ context, next }) => {
  console.log(`Requête: ${context.req.method} ${context.req.url}`)
  await next()
})
```

### `get(path, handler, version?)` / `post()` / `put()` / `patch()` / `delete()` / `options()` / `head()` / `trace()`

Déclarer une route manuellement :

```typescript
app.get("/health", async (ctx) => {
  return { status: "ok" }
})

app.post("/users", async (ctx) => {
  const { name, email } = ctx.req.body
  return { id: 1, name, email }
}, "v2") // version optionnelle
```

### `handle(req, reply)`

Point d'entrée du traitement des requêtes. Appelé par le runtime. Déconseillé en usage direct.

```typescript
// Usage interne uniquement
const response = await app.handle(incomingRequest, serverResponse)
```

## Flux de traitement d'une requête

```
app.handle(req, reply)
  │
  ├─ 1. Création de RequestContext
  ├─ 2. Hook 'onRequest'
  ├─ 3. MiddlewarePipeline.run(ctx, handler)
  │      ├─ bodyParserPlugin (parsing body automatique)
  │      ├─ Security plugins (CORS, headers...)
  │      └─ middlewares personnalisés
  ├─ 4. Router.match(method, pathname)
  │      └─ Si non trouvé → 404
  ├─ 5. Exécution du handler de route
  │      ├─ Paramètres injectés (@Param, @Query, @Body...)
  │      ├─ Validation DTO si applicable
  │      └─ Réponse → reply.send()
  └─ 6. Hook 'onResponse'
```

## Exemple complet

```typescript
import "reflect-metadata"
import { Application } from "raiton/core"
import { ThreadInterface } from "raiton/types"

export default async function (thread: ThreadInterface) {
  const app = new Application({
    port: 3000,
    prefix: "/api",
    verbose: true,
  })

  // Middleware global
  app.use(async ({ context, next }) => {
    const start = Date.now()
    await next()
    const ms = Date.now() - start
    context.reply.header("X-Response-Time", `${ms}ms`)
  })

  // Routes manuelles
  app.get("/ping", () => ({ pong: true }))
  app.post("/echo", (ctx) => ctx.req.body)

  return await thread.setup({ application: app }).run()
}
```

## Accès statique au conteneur DI

```typescript
Application.container === Injection // Vrai
Application.container.get("monService")
```

---

[← core/](README.md) | [↑ core/](README.md) | [router.md →](router.md)
