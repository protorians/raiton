# Raiton — Documentation Contributeur

Documentation orientée contribution au framework: architecture interne, noyau, runtime, décorateurs, plugins, CLI et types.

Pour l’usage applicatif, voir [../user-guide/README.md](../user-guide/README.md).

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

- [Structure de la documentation](#structure-de-la-documentation)
- [Points d'entrée (package.json exports)](#points-dentrée-packagejson-exports)
- [Conventions de commits](#conventions-de-commits)

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

### Fonctionnalités
Il faut toujours prioriser sur l'existant des fonctionnalités existantes avant de créer de nouvelles fonctionnalités.

### Commits
Les commits doivent être des commits logiques séparés par domaine, par fonctionnalité ou par objectif dans l'ordre de modifications des fichiers. 
Utiliser les préfixes suivants :

| Préfixe          | Usage |
|------------------|-------|
| `feat`           | Nouvelle fonctionnalité |
| `fix`            | Correction de bug |
| `breaking change`| Changement cassant (rétro-incompatible) |
| `release`        | Préparation de release |
| `upgrade`        | Mise à jour de dépendances |
| `update`         | Mise à jour de code existant (sans ajout de fonctionnalité) |
| `add`            | Ajout de code mineur (logs, helpers, fichiers de config) |
| `refactor`       | Refactoring sans changement de comportement |
| `chore`          | Tâches internes (build, config, CI, workspace) |
| `docs`           | Documentation uniquement |
| `remove`         | Suppression de code ou de fichiers |
| `deprecate`      | Marquage d'une fonctionnalité comme dépréciée |

Executer ```bun run version``` pour mettre à jour la version de l'application automatiquement
