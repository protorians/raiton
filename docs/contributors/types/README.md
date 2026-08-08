# Système de Types

**Dossier :** `source/types/`
**Import :** `import { ... } from "raiton/types"` ou `import type { ... } from "raiton/types"`

> **Navigation :** [← docs contributeur](../README.md) | [↑ Index](../README.md)

## Table des matières

- [Liste complète des fichiers de types](#liste-complète)
- [Interfaces clés](#interfaces-clés)
  - [ApplicationConfigInterface](#applicationconfiginterface)
  - [ThreadInterface](#threadinterface)
  - [ContextInterface](#contextinterface)
  - [MiddlewareParametersInterface](#middlewareparametersinterface)
  - [ContainerDefinitionInterface](#containerdefinitioninterface)
  - [PluginInterface](#plugininterface)
  - [ControllerMetaInterface](#controllermetainterface)
  - [ConfigurableInterface](#configurableinterface)
- [Export map](#export-map)

29 fichiers de types dans `source/types/`, tous réexportés via `source/types/index.ts`.

## Liste complète

| Fichier | Interface(s) principale(s) |
|---------|---------------------------|
| `application.ts` | `ApplicationInterface`, `ApplicationConfigInterface` |
| `artifact.ts` | Types d'artifacts |
| `builder.ts` | `BuilderInterface`, `BuilderConfigInterface` |
| `config.ts` | `ConfigurableInterface` |
| `contruct.ts` | `ConstructorType<T>` |
| `controller.ts` | `ControllerMetaInterface`, `RouteMetaInterface`, `RouteDecoratorCallable` |
| `core.ts` | `ContextInterface`, `RaitonCoreInterface` |
| `directory.ts` | Types de répertoires |
| `encryption.ts` | `EncryptionResultType`, `DerivationOptionsInterface`, `ScryptOptionsInterface` |
| `generic.ts` | Types génériques |
| `guard.ts` | Types de guards |
| `http-responses.ts` | Types de réponses HTTP |
| `injection.ts` | `ContainerDefinitionInterface` |
| `lifecycle.ts` | Types de cycle de vie |
| `middleware.ts` | `MiddlewareType`, `MiddlewareCallable`, `MiddlewareParametersInterface` |
| `parseable.ts` | Types de parsing |
| `plugin.ts` | `PluginInterface` |
| `raiton.ts` | Types statiques |
| `responses.ts` | Types de réponses |
| `router.ts` | Types de routage |
| `runtime.ts` | `RuntimeAdapterInterface`, `RuntimeServerInterface`, `RuntimeHandlerCallable` |
| `scheme.ts` | Types de schémas |
| `server.ts` | Types serveur |
| `socket.ts` | `SocketEventType` |
| `thread.ts` | `ThreadInterface`, `ThreadOptionsInterface`, `ThreadSetupOptionsInterface` |
| `utilities.ts` | Types utilitaires |
| `values.ts` | Types de valeurs |
| *(autres fichiers)* | |

## Interfaces clés

### `ApplicationConfigInterface`

```typescript
interface ApplicationConfigInterface {
  port?: number
  hostname?: string
  protocole?: string
  pathname?: string
  prefix?: string
  develop?: boolean
  verbose?: boolean
  workdir?: string
}
```

### `ThreadInterface`

```typescript
interface ThreadInterface {
  application: ApplicationInterface | null
  runtime: RuntimeAdapterInterface | null
  runtimeServer: RuntimeServerInterface | null
  readonly appDir: string
  readonly builder: BuilderInterface

  setup(options: ThreadSetupOptionsInterface): this
  run(): Promise<this>
  stop(): Promise<void>
  restart(): void
  sleep(ms: number): Promise<unknown>
  wait(condition: ThreadWaitCallable): Promise<void>
}
```

### `ContextInterface`

```typescript
interface ContextInterface {
  req: any
  reply: any
  state: Record<string, any>
  params?: Record<string, string>
  send?: (data: any) => void
}
```

### `MiddlewareParametersInterface`

```typescript
interface MiddlewareParametersInterface {
  context: RequestContext
  next: () => Promise<any>
}
```

### `ContainerDefinitionInterface`

```typescript
interface ContainerDefinitionInterface {
  name: string
  construct: ConstructorType
  lifetime: LifetimeEnum
  scope?: Symbol
}
```

### `PluginInterface`

```typescript
interface PluginInterface {
  name: string
  setup: (scope: PluginScope) => void
}
```

### `ControllerMetaInterface`

```typescript
interface ControllerMetaInterface {
  prefix: string
  routes: RouteMetaInterface[]
  middlewares: Record<string, any>
}
```

### `RouteMetaInterface`

```typescript
interface RouteMetaInterface {
  method: HttpMethod
  path: string
  propertyKey: string
}
```

### `ConstructorType`

```typescript
type ConstructorType<T = any> = new (...args: any[]) => T
```

### `ConfigurableInterface`

```typescript
interface ConfigurableInterface {
  rootDir?: string
  version?: string
  port?: number
  hostname?: string
  protocole?: string
  pathname?: string
  artifacts?: { types: string[] }
}
```

## Export map

```typescript
// source/types/index.ts
export type * from './config'
export type * from './builder'
export type * from './thread'
export type * from './guard'
export type * from './contruct'
export type * from './directory'
export type * from './encryption'
export type * from './generic'
export type * from './parseable'
export type * from './values'
export type * from './utilities'
export type * from './artifact'
export type * from './middleware'
export type * from './core'
export type * from './plugin'
export type * from './runtime'
export type * from './router'
export type * from './controller'
export type * from './socket'
export type * from './injection'
export type * from './responses'
export type * from './server'
export type * from './raiton'
export type * from './lifecycle'
```

---

[← docs/](../README.md) | [↑ Index](../README.md)
