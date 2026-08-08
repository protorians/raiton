# Démarrage rapide

> **Navigation :** [← user-guide](README.md) | [architecture →](architecture.md)

Le point d’entrée attendu est `source/main.ts`.
Le projet peut aussi définir `raiton.config.ts` à la racine pour décrire le `rootDir`, la version et les options globales.

La séparation attendue est la suivante :
- `raiton.config.ts` décrit le projet
- `source/main.ts` crée et démarre le serveur
- `source/modules/`, `source/controllers/`, `source/services/` et `source/repositories/` contiennent la logique applicative

## Installer

```bash
bun add raiton reflect-metadata
```

## Bootstrap

```typescript
import "reflect-metadata"
import { ThreadInterface } from "raiton/types"
import { Application } from "raiton/core"
import { RuntimeType } from "raiton/framework"

export default async (thread: ThreadInterface) => {
  const app = new Application({
    port: 5711,
    prefix: "/api"
  })

  return await thread.setup({
    application: app,
    runtime: RuntimeType.Bun
  }).run()
}
```

## Lancer

```bash
bun raiton dev
```

## Configuration projet

Exemple de fichier `raiton.config.ts` :

```typescript
export default {
  rootDir: "./source",
  version: "0.10.0",
  port: 5711,
  pathname: "/",
  artifacts: {
    types: ["controller", "socket", "service"]
  }
}
```

Dans ce schéma, Raiton charge les fichiers depuis `source/` et le bootstrapper reste dans `source/main.ts`.

## Vérifier

```bash
curl http://localhost:5711/api/users
```

---

[← user-guide](README.md) | [architecture →](architecture.md)
