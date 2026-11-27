# Recette — créer un projet

**Objectif** : créer, démarrer et tester une application sans édition manuelle.

**Commande**

```bash
raiton new demo --template api --runtime bun --yes
cd demo
bun raiton dev
```

**Fichier principal généré** (`source/main.ts`)

```ts
import "reflect-metadata"
import {Application} from "raiton/core"
import {RuntimeType} from "raiton/framework"
import type {ThreadInterface} from "raiton/types"

export default async (thread: ThreadInterface) => {
  const app = new Application({port: 5711, prefix: "/api"})
  return await thread.setup({application: app, runtime: RuntimeType.Bun}).run()
}
```

**Vérification**

```bash
curl http://localhost:5711/api/health
bun test
```

**Attendu** : `200` sur `/api/health`, tests générés au vert, aucune invite interactive en CI.
