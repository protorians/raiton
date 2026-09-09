# Décorateurs Scheduler

**Fichier :** `source/framework/decorators/scheduler.decorator.ts`
**Import :** `import { Scheduler, Cron, Every, Timeout, Task } from "raiton/framework"`

> **Navigation :** [← openapi.md](openapi.md) | [↑ decorators/](README.md)

Les décorateurs scheduler déclarent des jobs planifiés et des tâches nommées, compilés par `compileScheduler` puis gérés par le `SchedulerManager`.

## `@Scheduler(options?)`

Marque une classe comme conteneur de jobs. Enregistre la classe en DI (`Injectable` transient) et dans le registre des schedulers.

```typescript
@Scheduler({ name: "maintenance", queue: "default", timezone: "UTC" })
export class MaintenanceScheduler { /* ... */ }
```

**Fonctionnement interne :**
1. `Injectable(LifetimeEnum.TRANSIENT, name)` → enregistre dans le DI
2. `getSchedulerMetadata(target.prototype)` → métadonnées de classe
3. `registerScheduler(target)` → registre des schedulers

## `@Cron(expression, options?)`

Planifie une méthode selon une expression cron 5 ou 6 champs (ou une macro).

```typescript
@Cron("0 3 * * *", { name: "daily-cleanup", timezone: "Europe/Paris" })
async cleanup(ctx: TaskContextInterface) { /* ... */ }
```

## `@Every(interval, options?)` (alias `@Interval`)

Planifie une méthode à intervalle fixe. `interval` est un nombre de millisecondes ou une durée `"5s"`, `"1m30s"`, `"2h"`. L'option `immediate` exécute une première fois au démarrage.

```typescript
@Every("5m", { name: "heartbeat", immediate: true })
async heartbeat() { /* ... */ }
```

## `@Timeout(delay, options?)`

Planifie une exécution unique après `delay`.

```typescript
@Timeout("30s", { name: "warmup" })
async warmup() { /* ... */ }
```

## `@Task(name, options?)`

Déclare une tâche nommée : dispatchable en process, enqueueable sur une file et, si `consume: true`, consommée en tant que worker.

```typescript
@Task("email:welcome", { queue: "emails", consume: true, retries: 3, concurrency: 5 })
async welcome(ctx: TaskContextInterface<{ to: string }>) { /* ... */ }
```

## Métadonnées

Les métadonnées sont stockées sur le prototype via `METADATA_KEYS.SCHEDULER` (symbole Reflect) :

```typescript
interface SchedulerMetaInterface {
  name: string
  queue: string
  timezone?: string
  jobs: JobMetaInterface[]
}
```

Chaque job (`JobMetaInterface`) porte `propertyKey`, `name`, `type` (`cron` | `interval` | `timeout` | `task`), le champ de planification (`cron` | `interval` | `delay`), `queue` et `options`.

## Notes

- Les artifacts `*.scheduler.ts` (ainsi que `*.task.ts`, `*.cron.ts`, `*.job.ts`) sont scannés au boot et rechargés en HMR (`hmr:scheduler`).
- Le handler reçoit un `TaskContextInterface` (`name`, `queue`, `payload`, `trigger`, `attempt`, `scheduler`…).
- Les options communes (`singleton`, `concurrency`, `retries`, `retryDelay`, `timeout`, `catchUp`, `enabled`, `consume`, `priority`, `data`) sont résolues par `SchedulerManager.resolveOptions()`.

---

[← openapi.md](openapi.md) | [↑ decorators/](README.md)
