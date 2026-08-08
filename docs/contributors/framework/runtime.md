# Runtime

**Fichiers :** `source/framework/runtime/`
**Import :** `import { Runtime, RuntimeType } from "raiton/framework"`

> **Navigation :** [← framework/](README.md) | [↑ framework/](README.md) | [responses.md →](responses.md)

## `Runtime`

Fabrique d'adaptateurs runtime. Choisit automatiquement l'implémentation de serveur HTTP selon l'environnement.

```typescript
class Runtime {
  constructor(public readonly type: RuntimeType)

  get isNode(): boolean
  get isBun(): boolean

  adapter(): RuntimeAdapterInterface
  createServer(handler: RuntimeHandlerCallable): RuntimeServerInterface
}
```

### Création

```typescript
// Détection automatique (dans RaitonThread.setup) :
const defaultRuntime = typeof Bun !== 'undefined' ? RuntimeType.Bun : RuntimeType.Node

// Manuel :
const runtime = new Runtime(RuntimeType.Bun)
const runtime = new Runtime(RuntimeType.Node)
```

### Création du serveur

```typescript
const runtime = new Runtime(RuntimeType.Bun)
const server = runtime.createServer(async (req, reply) => {
  reply.send({ message: "Hello" })
})
await server.listen(3000, "0.0.0.0")
```

## Adaptateurs disponibles

### `bunRuntime` (Bun.serve)

**Fichier :** `source/framework/runtime/bun/server.ts`

Utilise `Bun.serve()` de manière native pour des performances maximales.

```typescript
// Utilisation interne :
const server = bunRuntime.createServer(handler)
await server.listen(port, hostname)
```

- **TCP** : `Bun.listen({ ... })`
- **Requêtes** : Native `Request` / `Response`
- **Recommandé** pour la production

### `nodeRuntime` (Node.js HTTP)

**Fichiers :** `source/framework/runtime/node/`

Utilise `node:http.createServer()` avec des wrappers pour standardiser l'interface.

```typescript
// Fichiers :
node/
├── server.ts    → nodeRuntime.createServer(handler) → listen(port, hostname)
├── request.ts   → NodeRequest (wrapper IncomingMessage)
└── reply.ts     → NodeReply (wrapper ServerResponse)
```

- `NodeRequest` : wrapper autour de `IncomingMessage` avec interface `RequestInterface`
- `NodeReply` : wrapper autour de `ServerResponse` avec interface `ReplyInterface`

### `denoRuntime` (stub)

**Fichier :** `source/framework/runtime/deno/server.ts`

Non implémenté — stub uniquement.

## Interface `RuntimeAdapterInterface`

```typescript
interface RuntimeAdapterInterface {
  createServer(handler: RuntimeHandlerCallable): RuntimeServerInterface
}

interface RuntimeServerInterface {
  listen(port: number, hostname?: string): Promise<void>
}
```

## Exemple d'utilisation

```typescript
import { Runtime, RuntimeType } from "raiton/framework"
import type { ThreadInterface } from "raiton/types"
import { Application } from "raiton/core"
import "reflect-metadata"

export default async function (thread: ThreadInterface) {
  const app = new Application({ port: 3000 })

  // Runtime est configuré automatiquement par thread.setup()
  // Mais on peut spécifier manuellement :
  return await thread
    .setup({ application: app, runtime: RuntimeType.Bun })
    .run()
}
```

## Détection automatique

Dans `RaitonThread.setup()` :

```typescript
setup({ application, runtime }) {
  const defaultRuntime = typeof Bun !== 'undefined'
    ? RuntimeType.Bun
    : RuntimeType.Node

  this.runtime = new Runtime(runtime || defaultRuntime)
  this.application = application
}
```

Si aucun runtime n'est spécifié, Raiton détecte automatiquement :
- **Bun** si `globalThis.Bun` est défini
- **Node.js** sinon

---

[← framework/](README.md) | [↑ framework/](README.md) | [responses.md →](responses.md)
