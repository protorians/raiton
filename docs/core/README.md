# Module Core (`source/core/`)

Le noyau de Raiton gère le cycle de vie de l'application, le routage, le middleware, l'injection de dépendances, les plugins et la configuration.

> **Navigation :** [← docs/](../README.md) | [↑ Index](../README.md) | [application.md →](application.md)

## Table des matières

| Fichier | Description |
|---------|-------------|
| [application.md](application.md) | Classe `Application` — configuration, routes, middleware |
| [router.md](router.md) | Système de routage — `Router`, `RouteMatcher` |
| [middleware.md](middleware.md) | Pipeline middleware — `MiddlewarePipeline` |
| [controller.md](controller.md) | Contrôleurs — `ControllerBuilder`, compilation |
| [injection.md](injection.md) | Injection de dépendances — `Injection`, scopes |
| [plugin-scope.md](plugin-scope.md) | Système de plugins — `PluginScope` |
| [config.md](config.md) | Configuration — `RaitonConfig` |
| [builder-thread.md](builder-thread.md) | Build et thread — `RaitonBuilder`, `RaitonThread` |

```
core/
├── application.ts     → Application — point d'entrée de l'app HTTP
├── builder.ts         → RaitonBuilder — build, serve, HMR
├── thread.ts          → RaitonThread — cycle de vie, serveur
├── context.ts         → RequestContext — état de la requête
├── raiton.ts          → Ration — signaux, thread (statique)
├── server.ts          → Server — config serveur (singleton)
├── hooks.ts           → HookStore — hooks de cycle de vie
├── guards.ts          → RaitonGuards — registre de guards
├── commands.ts        → RaitonCommands — moissonnage de commandes
├── command.ts         → RaitonCommand — classe de base CLI
├── directories.ts     → RaitonDirectories — chemins de travail
├── bytes.util.ts      → parseBytes, formatBytes
├── process.util.ts    → until (attente conditionnelle)
├── config/
│   ├── config.ts      → RaitonConfig — chargeur de config
│   └── define.ts      → defineConfig — builder depuis package.json
├── controller/
│   ├── metadata.ts    → getControllerMetadata
│   ├── compiler.ts    → compileController
│   └── builder.ts     → ControllerBuilder
├── router/
│   ├── router.ts      → Router
│   ├── route.ts       → Route
│   ├── matcher.ts     → RouteMatcher
│   ├── handler.ts     → createHandler
│   └── handler.utils.ts → collecte d'arguments, validation
├── middleware/
│   ├── compose.ts     → middlewareCompose (Koa-style)
│   └── pipeline.ts    → MiddlewarePipeline
├── plugins/
│   ├── plugin.ts      → definePlugin
│   └── scope.ts       → PluginScope
├── injection/
│   └── injection.ts   → Injection (conteneur DI)
├── socket/
│   └── metadata.ts    → getSocketMetadata
├── artifacts/
│   ├── artifact.ts    → Artifact
│   └── runner.ts      → artifactRunner (stub)
└── helpers/
    └── raiton.ts      → helper raiton (stub)
```

---

[← docs/](../README.md) | [↑ Index](../README.md) | [application.md →](application.md)
