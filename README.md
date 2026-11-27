# Protorians Raiton

[![Version](https://img.shields.io/npm/v/raiton.svg)](https://www.npmjs.com/package/raiton)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Protorians Raiton** est un framework backend moderne et performant, 
conçu pour construire des microservices TypeScript. Optimisé pour **Bun**, 
il offre également un support complet pour **Node.js** et **Deno**.

## Caractéristiques

- **Optimisé pour Bun** : Utilise `Bun.serve` nativement pour des performances maximales.
- **Multi-Runtime** : Compatible avec Bun (recommandé), Node.js et les environnements Web.
- **Architecture Décorative** : Utilise les décorateurs TypeScript pour définir contrôleurs, routes et injections.
- **Modulaire** : Système de plugins et de middlewares flexible.
- **CLI Puissant** : Création de projet, générateurs, inventaire, diagnostic, OpenAPI, client typé et contrats.
- **Schema-first** : une seule définition TypeBox alimente validation runtime, types, OpenAPI et client.
- **AI-friendly** : manifeste versionné, `llms.txt`, `AGENTS.md`, MCP HTTP **et** stdio.
- **Observabilité opt-in** : corrélation, métriques Prometheus, traces OTLP, arrêt gracieux.

## Installation

```bash
bun add raiton reflect-metadata
# ou
npm install raiton reflect-metadata
```

> **Note :** Raiton nécessite `reflect-metadata` pour fonctionner avec les décorateurs. Importez-le au début de votre point d'entrée.

## Démarrage Rapide

### 1. Créez un contrôleur (`source/controllers/hello.controller.ts`)

```typescript
import { Controllable, Get, Param } from "raiton/framework";

@Controllable('/hello')
export class HelloController {
    @Get('/')
    index() {
        return { message: "Bonjour de Raiton !" };
    }

    @Get('/:name')
    greet(@Param("name") name?: string) {
        return { message: `Bonjour, ${name} !` };
    }
}
```

### 2. Configurez votre application (`source/main.ts`)

```typescript
import "reflect-metadata";
import { ThreadInterface } from "raiton/types";
import { Application } from "raiton/core";
import { RuntimeType } from "raiton/framework";

export default async (thread: ThreadInterface) => {
    const app = new Application({
        port: 5711,
        prefix: '/api'
    });

    return await thread.setup({
        application: app,
        runtime: RuntimeType.Bun
    }).run()
}
```

> **Note :** selon la configuration du projet, le bootstrapper est chargé depuis `source/main.ts` et la racine du projet peut être définie par `raiton.config.ts` via `rootDir`.

## Créer un projet

```bash
bun raiton new my-api --template api --runtime bun --yes
cd my-api
bun raiton dev
bun test
```

```bash
bun raiton generate resource users       # contrôleur + service + dépôt + DTO + test
bun raiton inspect --json                # inventaire machine-readable
bun raiton doctor                        # diagnostic actionnable
bun raiton openapi export --out openapi.json
bun raiton client --out ./sdk
bun raiton mcp conformance --json
```

## Contrats schema-first

```typescript
import { t } from "raiton/contracts"

export const CreateUser = t.object({
  email: t.string().email(),
  name: t.string().min(2),
})
export type CreateUser = t.infer<typeof CreateUser>
```

```typescript
@Post("/")
@Input(CreateUser)
@Output(User)
create(@Body() input: CreateUser) {
  return this.users.create(input)
}
```

Les charges invalides sont rejetées avant le handler avec un code stable
`VALIDATION_ERROR`, et le client généré compile sans `any`.

## Utilisation du CLI

Raiton est livré avec une interface en ligne de commande pour faciliter le développement.
Il fonctionne sur **Bun**, **Node.js** et **Deno**.

```bash
# Bun — exécution TypeScript native
bun raiton dev      # mode développement avec HMR
bun raiton build    # build du projet
bun raiton start    # démarrage en production (sans HMR)

# Node.js (bundle JS préalable : bun run build)
node build/bin/index.mjs dev
node build/bin/index.mjs start

# Deno
deno task dev       # mode développement avec HMR (--watch)
deno task build
deno task start     # démarrage en production
deno task compile   # binaire autonome stable et rapide
```

## Déboguer avec un agent IA

Les surfaces de debug sont opt-in et désactivées par défaut en production.

```bash
bun raiton call GET /api/items/:id --param id=42 --json
bun raiton requests --since 5m
bun raiton explain --last --json
bun raiton verify --json
bun raiton mcp debug --stdio        # ou --http --port 5711
```

- résolution de route et validation locale avant envoi ;
- journal borné, expurgé et explications avec chronologie, source et actions ;
- serveur MCP de debug (`routes.list`, `routes.call`, `requests.explain`, `manifest.get`, …) ;
- erreurs enrichies avec attendu, reçu, emplacement et `hint` en développement.

Voir [docs/user-guide/debug.md](docs/user-guide/debug.md).

## Runtimes supportés

Raiton détecte automatiquement l'environnement d'exécution et adapte son serveur :

- **Bun** : Utilisation de `Bun.serve`.
- **Node.js** : Adaptateur pour serveurs HTTP Node.
- **Deno** : Utilisation de `Deno.serve`.

## Documentation API

Pour l’usage applicatif, voir le guide développeur : [docs/user-guide/README.md](docs/user-guide/README.md)

Example
```typescript
  import { Controllable, Get, ApiOkResponse, ApiResponse } from 'raiton/framework';

  @Controllable('/users')
  export class UserController {
      @Get()
      @ApiOkResponse({
          description: 'Returns a list of users',
          type: Array,
          isArray: true
      })
      async getUsers() {
          return [{ id: 1, name: 'John Doe' }, { id: 2, name: 'Jane Smith' }];
      }

      @Get('/:id')
      @ApiResponse({
          status: 200,
          description: 'Returns the user if found',
          type: Object
      })
      @ApiResponse({
          status: 404,
          description: 'User not found'
      })
      async getUserById() {
          // ... implementation
          return { id: 1, name: 'John Doe' };
      }
  }
```

```typescript
import { Controllable, Get, ApiQuery } from "raiton/framework";

  @Controllable("/users")
  export class UserController {
    @Get()
    @ApiQuery("name", { description: "Filter by name", required: false, type:
  String })
    @ApiQuery("limit", { description: "Max results", required: false, type:
  Number })
    async getUsers(ctx) {
      const { name, limit } = ctx.query;
      // …
    }
  }
```

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---
Développé avec ❤️ par **Y. Yannick GOBOU**
