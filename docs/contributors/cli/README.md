# CLI (Interface en Ligne de Commande)

**Fichiers :** `source/bin/`, `source/commands/`
**Import CLI :** `bun raiton <commande>`

> **Navigation :** [← docs contributeur](../README.md) | [↑ Index](../README.md) | [commands.md →](commands.md)

## Table des matières

| Fichier | Description |
|---------|-------------|
| [commands.md](commands.md) | Détail des commandes `new`, `generate`, `routes`, `inspect`, `why`, `doctor`, `openapi`, `client`, `contract`, `mcp`, `docs`, `develop`, `build`, `start`, `artifact` |
| [hmr.md](hmr.md) | Fonctionnement du Hot Module Replacement |

## Commandes disponibles

| Commande | Alias | Description |
|----------|-------|-------------|
| `develop` | `dev` | Mode développement avec Hot Reload |
| `build` | `b` | Compilation TypeScript vers JavaScript |
| `start` | `run` | Démarrage en production |
| `artifact` | `art` | Gestion des artifacts |
| `generate` | `g` | Génération d'artifacts |
| `inspect` | - | Inventaire machine-readable |
| `doctor` | - | Diagnostic actionnable |
| `mcp` | - | Outils MCP HTTP/stdio |
| `docs` | - | Documentation pour agents |

```bash
# Aide
bun raiton --help

# Version
bun raiton --version
```

## Structure des fichiers CLI

```
bin/
├── index.ts           ← Point d'entrée (shebang)
├── cli.ts             ← Définition Commander
├── bootstrapper.ts    ← Initialisation
├── cli-tools.ts       ← Utilitaires cross-runtime
└── constants.ts       ← Détection de runtime

commands/
├── start.command.ts      ← start/run
├── develop.command.ts    ← develop/dev
├── build.command.ts      ← build/b
├── artifact.command.ts   ← artifact/art
├── new.command.ts        ← création de projet
├── generate.command.ts   ← génération d'artifacts
├── routes.command.ts     ← liste des routes
├── inspect.command.ts    ← manifeste de projet
├── why.command.ts        ← origine d'une route
├── doctor.command.ts     ← diagnostic
├── openapi.command.ts    ← export OpenAPI
├── client.command.ts     ← client typé
├── contract.command.ts   ← contrôle de contrat
├── mcp.command.ts        ← outils MCP
└── docs.command.ts       ← documentation agents
```

## Flux de démarrage

```typescript
// source/bin/index.ts
import "reflect-metadata"
import CLI from "./cli"
import { bootstrapper } from "./bootstrapper"

bootstrapper(CLI)
```

```typescript
// source/bin/bootstrapper.ts
bootstrapper(CLI) {
  1. Récupère le répertoire de travail (workdir + appdir)
  2. RaitonCommands.harvest() → scanne les commandes du projet
  3. RaitonConfig.sync(workdir) → charge la configuration
  4. CLI.parse(process.argv) → exécute la commande
}
```

## Documentation détaillée

| Fichier | Description |
|---------|-------------|
| `commands.md` | Détail de chaque commande avec exemples |
| `hmr.md` | Fonctionnement du Hot Module Replacement |

---

[← docs/](../README.md) | [↑ Index](../README.md) | [commands.md →](commands.md)
