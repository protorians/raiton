# CLI (Interface en Ligne de Commande)

**Fichiers :** `source/bin/`, `source/commands/`
**Import CLI :** `bun raiton <commande>`

> **Navigation :** [← docs/](../README.md) | [↑ Index](../README.md) | [commands.md →](commands.md)

## Table des matières

| Fichier | Description |
|---------|-------------|
| [commands.md](commands.md) | Détail des commandes `develop`, `build`, `start`, `artifact`, `grafts` |
| [hmr.md](hmr.md) | Fonctionnement du Hot Module Replacement |

## Commandes disponibles

| Commande | Alias | Description |
|----------|-------|-------------|
| `develop` | `dev` | Mode développement avec Hot Reload |
| `build` | `b` | Compilation TypeScript vers JavaScript |
| `start` | `run` | Démarrage en production |
| `artifact` | `art` | Gestion des artifacts |
| `grafts` | - | Génération de typings |

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
└── grafts.command.ts     ← grafts
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
