# Protorians Raiton

[![Version](https://img.shields.io/npm/v/raiton.svg)](https://www.npmjs.com/package/raiton)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Protorians Raiton** est un kit de développement (SDK) backend moderne et performant, 
conçu pour construire des microservices TypeScript. Optimisé pour **Bun**, 
il offre également un support complet pour **Node.js** et **Deno**.

## Caractéristiques

- **Optimisé pour Bun** : Utilise `Bun.serve` nativement pour des performances maximales.
- **Multi-Runtime** : Compatible avec Bun (recommandé), Node.js et les environnements Web.
- **Architecture Décorative** : Utilise les décorateurs TypeScript pour définir contrôleurs, routes et injections de dépendances.
- **Validation DTO** : Intégration native de `class-validator` pour la validation des données entrantes.
- **Cycle de Vie** : Support des hooks `onInit`, `onMount` et `onUnmount` pour les services et contrôleurs.
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
import { Controllable, Get, Param } from "raiton/sdk";

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

### 3. Validation avec DTO (`source/dtos/user.dto.ts`)

Raiton intègre `class-validator` pour valider vos données entrantes via des DTOs.

```typescript
import { DataTransferObject } from "raiton/sdk";
import { IsString, MinLength } from "class-validator";

export class CreateUserDto extends DataTransferObject {
    @IsString()
    @MinLength(3)
    name: string;
}
```

Utilisez-le dans votre contrôleur :

```typescript
import { Controllable, Post, Body } from "raiton/sdk";
import { CreateUserDto } from "../dtos/user.dto";

@Controllable('/users')
export class UserController {
    @Post('/')
    create(@Body(CreateUserDto) body: CreateUserDto) {
        return { message: `Utilisateur ${body.name} créé !` };
    }
}
```

## Utilisation du CLI

Raiton est livré avec une interface en ligne de commande pour faciliter le développement.

> **Note :** Il est recommandé d'utiliser **Bun** pour une meilleure expérience.

```bash
# Lancer en mode développement (avec hot reload)
raiton develop

# Builder le projet
raiton build

# Démarrer le projet buildé
raiton start
```

Si `raiton` n'est pas dans votre PATH, utilisez `bun x raiton` ou `npx raiton`.

## 🛠 Runtimes supportés

Raiton détecte automatiquement l'environnement d'exécution et adapte son serveur :

- **Bun** : Utilisation de `Bun.serve`.
- **Node.js** : Adaptateur pour serveurs HTTP Node.
- **Web** : Compatible avec les environnements basés sur les standards Web (Fetch API).

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---
Développé avec ❤️ par **Y. Yannick GOBOU**
