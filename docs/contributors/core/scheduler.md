# Scheduler

**Fichiers :** `source/core/scheduler/`
**Import :** `import { SchedulerManager, compileScheduler, parseCron, MemoryQueueBackend, RedisQueueBackend, RabbitMqQueueBackend } from "raiton/core"`

> **Navigation :** [← injection.md](injection.md) | [↑ core/](README.md) | [plugin-scope.md →](plugin-scope.md)

## Vue d'ensemble

Le module `core/scheduler/` fournit un task scheduler déclaratif. Il repose sur un `SchedulerManager` singleton qui détient les jobs compilés, les planifie (cron, intervalle, timeout) et consomme les files d'attente via des backends interchangeables.

```
core/scheduler/
├── cron.ts            → parseur cron pur + calcul du prochain run (timezone-aware)
├── duration.ts        → parseur de durées ("5s", "1h30m", …) vers millisecondes
├── metadata.ts        → registre des schedulers (getSchedulerMetadata, registerScheduler)
├── manager.ts         → SchedulerManager (cycle de vie, jobs, workers, contrôle)
├── builder.ts         → compileScheduler (résolution DI + enregistrement)
└── queue/
    ├── backend.ts     → BaseQueueBackend + MemoryQueueBackend
    ├── redis.backend.ts     → RedisQueueBackend (import paresseux de `redis`)
    └── rabbitmq.backend.ts  → RabbitMqQueueBackend (import paresseux de `amqplib`)
```

## Décorateurs → métadonnées

Les décorateurs (`framework/decorators/scheduler.decorator.ts`) écrivent les métadonnées sur le prototype de la classe, de la même façon que les sockets ou MCP :

- `@Scheduler()` — marque la classe, l'enregistre en DI (`Injectable`) et dans le registre
- `@Cron()`, `@Every()`, `@Timeout()`, `@Task()` — poussent un `JobMetaInterface` dans `meta.jobs`

```typescript
interface JobMetaInterface {
  propertyKey: string
  name: string
  type: 'cron' | 'interval' | 'timeout' | 'task'
  cron?: string
  interval?: number
  delay?: number
  queue?: string
  options: TaskOptionsInterface
}
```

## `compileScheduler`

Compile une classe décorée en job enregistré dans le `SchedulerManager`.

```typescript
compileScheduler(SchedulerClass)
// 1. Lit les métadonnées (getSchedulerMetadata)
// 2. Ré-enregistre dans le registre (registerScheduler)
// 3. Résout l'instance via Injection.resolve(SchedulerClass)
// 4. SchedulerManager.register(name, instance, metadata.jobs)
```

Appelé par `ControllerBuilder.build()` pour les artifacts `*.scheduler.ts`, et par `Artifacts.reloadScheduler()` en HMR.

## `SchedulerManager`

Singleton (`SchedulerManager.current`) implémentant `SchedulerControlInterface`.

### Cycle de vie

- `register(name, instance, jobs)` — crée les `JobRuntime`, les ajoute au `_jobs`
- `start()` — connecte les backends, arme les timers, lance les workers
- `stop()` — coupe les timers, attend les workers, déconnecte les backends

Le démarrage est piloté par `RaitonThread.run()` (après le scan des artifacts) et l'arrêt par `RaitonThread.stop()`.

### Planification

- **cron** : `armCron()` calcule le prochain run via `parseCron(...).next()` puis pose un `setTimeout` auto-réarmant (pas de dérive)
- **intervalle** : `armInterval()` pose un `setTimeout` auto-réarmant de `interval` ms
- **timeout** : `armTimeout()` pose un `setTimeout` unique

### Exécution

- `dispatchNow()` applique la garde `singleton` (et `catchUp`)
- `runOnce()` gère compteurs, `retries`, `retryDelay` et `timeout`
- `consume()` boucle `backend.dequeue()` pour les tâches `consume: true`, avec `concurrency`

### Contrôle

`dispatch()` / `trigger()` (in-process), `enqueue()` (file), `pause()`, `resume()`, `cancel()`, `getJobs()`, `getJob()`, `has()`.

## Backends de file

`QueueBackendInterface` est le contrat d'un backend :

```typescript
interface QueueBackendInterface {
  readonly name: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  enqueue(queue, message): Promise<string>
  dequeue(queue, options?): Promise<QueueMessageInterface[]>
  acknowledge(queue, receipt): Promise<void>
  reject(queue, receipt, requeue?): Promise<void>
  length(queue): Promise<number>
  purge(queue): Promise<void>
}
```

- `MemoryQueueBackend` (défaut) — listes en mémoire, visibilité timeout, dequeue bloquant par polling
- `RedisQueueBackend` — `RPUSH` / `LMOVE` vers une liste `:processing` / `LREM`
- `RabbitMqQueueBackend` — `sendToQueue` / `get` + ack/nack manuel

`registerBackend(name, backend)` et `mapQueue(queue, backendName)` permettent d'aiguiller chaque file vers un backend. Les paquets `redis` et `amqplib` sont importés paresseusement (`@ts-ignore`) et ne sont requis que si le backend correspondant est utilisé.

---

[← injection.md](injection.md) | [↑ core/](README.md) | [plugin-scope.md →](plugin-scope.md)
