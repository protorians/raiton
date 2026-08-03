# Raiton — Documentation Développeur

Framework backend TypeScript modulaire avec injection de dépendances, plugins, contrôleurs, middleware et hot-reloading. Optimisé pour **Bun**, compatible **Node.js** et **Deno**.

```
Version: 5.9.4-beta.15  |  Runtime: Bun (recommandé), Node.js, Deno  |  Licence: MIT
```

## Navigation

| Section | Description |
|---------|-------------|
| [core/](core/README.md) | Noyau : Application, Router, Middleware, DI, Plugins, Config |
| [framework/](framework/README.md) | Décorateurs, Runtime, Réponses, Encryption, Plugins intégrés |
| [cli/](cli/README.md) | CLI, commandes develop/build/start, HMR |
| [types/](types/README.md) | Système de types et interfaces |

## Structure de la documentation

```
docs/
├── README.md                  ← Ce fichier
├── core/                      ← Module noyau
│   ├── README.md              ← Sommaire core/
│   ├── application.md         ← Classe Application
│   ├── router.md              ← Router, Route, RouteMatcher
│   ├── middleware.md          ← Pipeline middleware
│   ├── controller.md          ← ControllerBuilder, compilation
│   ├── injection.md           ← Injection de dépendances
│   ├── plugin-scope.md        ← Système de plugins
│   ├── config.md              ← Configuration
│   └── builder-thread.md      ← Build, thread, cycle de vie
├── framework/                 ← Module framework
│   ├── README.md              ← Sommaire framework/
│   ├── runtime.md             ← Adaptateurs Bun/Node/Deno
│   ├── responses.md           ← Réponses et exceptions
│   ├── encryption.md          ← Hachage et chiffrement
│   ├── env.md                 ← Variables d'environnement
│   ├── base-classes.md        ← DTO, ViewModel, Service, Repository
│   ├── decorators/            ← Décorateurs
│   │   ├── README.md          ← Sommaire décorateurs
│   │   ├── controllable.md    ← @Controllable, @Get, @Post...
│   │   ├── parametrable.md    ← @Param, @Query, @Body...
│   │   ├── injection.md       ← @Injectable, @Inject
│   │   ├── middleware.md      ← @Middleware
│   │   ├── socket.md          ← @Socket, événements socket
│   │   └── openapi.md         ← Décorateurs OpenAPI
│   └── plugins/               ← Plugins intégrés
│       ├── README.md          ← Sommaire plugins
│       ├── body-parser.md     ← Body parser
│       ├── openapi.md         ← Plugin OpenAPI
│       └── security.md        ← CORS, headers, rate-limit...
├── cli/                       ← CLI
│   ├── README.md              ← Sommaire CLI
│   ├── commands.md            ← Commandes disponibles
│   └── hmr.md                 ← Hot Module Replacement
└── types/                     ← Types
    └── README.md              ← 29 fichiers de types
```

## Table des matières

- [Démarrage rapide](#démarrage-rapide)
- [Points d'entrée (package.json exports)](#points-dentrée-packagejson-exports)
- [Conventions de commits](#conventions-de-commits)

## Démarrage rapide

```bash
# Installation
bun add raiton reflect-metadata
```

```typescript
// source/controllers/hello.controller.ts
import { Controllable, Get, Param } from "raiton/framework"

@Controllable("/hello")
export class HelloController {
  @Get("/") 
  index() {
    return { message: "Bonjour de Raiton !" }
  }

  @Get("/:name")
  greet(@Param("name") name?: string) {
    return { message: `Bonjour, ${name} !` }
  }
}

// source/main.ts (bootstrapper)
import "reflect-metadata"
import { ThreadInterface } from "raiton/types"
import { Application } from "raiton/core"
import { HelloController } from "./controllers/hello.controller"

export default async function (thread: ThreadInterface) {
  const app = new Application({ port: 3000, prefix: "/api" })
  app.register({ setup: (s) => s.get("/hello", (c) => c.reply.send("Hello")))
  return await thread.setup({ application: app }).run()
}
```

```bash
# Lancer en développement
bun raiton dev
```

## Points d'entrée (package.json exports)

| Import | Chemin |
|--------|--------|
| `raiton` ou `raiton/core` | `source/core/index.ts` |
| `raiton/core/*` | `source/core/*.ts` |
| `raiton/framework` | `source/framework/index.ts` |
| `raiton/framework/*` | `source/framework/*.ts` |
| `raiton/types` | `source/types/index.ts` |
| `raiton/types/*` | `source/types/*.ts` |
| `raiton/commands/*` | `source/commands/*.ts` |

## Conventions 

### Fonctionnalités
Il faut toujours prioriser sur l'existant des fonctionnalités existantes avant de créer de nouvelles fonctionnalités.

### Commits

| Préfixe | Domaine |
|---------|---------|
| `core:` | Noyau (Application, Router, DI, etc.) |
| `framework:` | Décorateurs, runtime, plugins |
| `cli:` | Ligne de commande |
| `docs:` | Documentation |
| `types:` | Définitions de types |
| `fix:` | Correction de bug |
| `chore:` | Maintenance |
