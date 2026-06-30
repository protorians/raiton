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
- **CLI Puissant** : Outils intégrés pour le développement, le build et le déploiement.

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
import {ThreadInterface} from "raiton/types";
import {Application} from "raiton/core";

export default async function (thread: ThreadInterface) {
    const app = new Application({
        port: 3000,
        prefix: '/api'
    });

    // Enregistrez vos plugins, middlewares et contrôleurs ici
    // ...

    // Lier son application au thread
    return await thread.setup({application: app}).run()
}
```

## Utilisation du CLI

Raiton est livré avec une interface en ligne de commande pour faciliter le développement.

```bash
# Lancer en mode développement (avec hot reload)
bun raiton develop

# Builder le projet
bun raiton build

# Démarrer le projet buildé
bun raiton start
```

## Runtimes supportés

Raiton détecte automatiquement l'environnement d'exécution et adapte son serveur :

- **Bun** : Utilisation de `Bun.serve`.
- **Node.js** : Adaptateur pour serveurs HTTP Node.
- **Web** : Compatible avec les environnements basés sur les standards Web (Fetch API).

## Documentation API

Example
```typescript
  import { Controllable, Get, ApiOkResponse, ApiResponse } from '@protorians/framework';

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

## Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---
Développé avec ❤️ par **Y. Yannick GOBOU**
