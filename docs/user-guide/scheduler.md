# Scheduler (tâches planifiées et files d’attente)

> **Navigation :** [← mcp](mcp.md) | [types →](types.md)

Raiton fournit un **task scheduler** intégré, décrit par des décorateurs, pour exécuter des tâches à intervalle régulier, à heure fixe (cron) ou via des **files d’attente** (mémoire, Redis, RabbitMQ…).

## De quoi s’agit-il

Le scheduler permet de :

- planifier des jobs **cron** (`@Cron`), **périodiques** (`@Every`) ou **différés** (`@Timeout`)
- déclarer des **tâches nommées** (`@Task`) exécutables à la demande
- distribuer et consommer ces tâches via une **file d’attente** pluggable
- bénéficier de la même découverte d’artifacts, du HMR et de l’injection de dépendances que le reste du framework

## Pourquoi utilisé

- exécuter des travaux récurrents : nettoyage, synchronisation, rapports, agrégation
- découpler la production d’un travail de son exécution (producteur / consommateur)
- répartir la charge entre plusieurs instances en branchant Redis ou RabbitMQ
- garder une API déclarative et typée, sans dépendance externe par défaut

## Comment l’utiliser

1. Créez un fichier artifact `*.scheduler.ts` (ou `*.task.ts`, `*.cron.ts`, `*.job.ts`)
2. Déclarez une classe avec `@Scheduler()`
3. Ajoutez des méthodes avec `@Cron`, `@Every`, `@Timeout` ou `@Task`
4. Le scheduler démarre automatiquement au lancement de l’application

## Exemple

```typescript
import { Scheduler, Cron, Every, Task } from "raiton/framework"
import type { TaskContextInterface } from "raiton/types"

@Scheduler({ name: "maintenance", queue: "default" })
export class MaintenanceScheduler {
  @Cron("0 3 * * *", { name: "daily-cleanup", timezone: "Europe/Paris" })
  async cleanup(ctx: TaskContextInterface) {
    // exécuté chaque jour à 03:00 (heure de Paris)
  }

  @Every("5m", { name: "heartbeat", immediate: true })
  async heartbeat() {
    // exécuté immédiatement, puis toutes les 5 minutes
  }

  @Timeout("30s", { name: "warmup" })
  async warmup() {
    // exécuté une seule fois, 30 secondes après le démarrage
  }

  @Task("email:welcome", { queue: "emails", consume: true, retries: 3, concurrency: 5 })
  async welcome(ctx: TaskContextInterface<{ to: string }>) {
    // tâche nommée, consommée depuis la file "emails"
  }
}
```

Aucun enregistrement supplémentaire n’est nécessaire : le scanner détecte l’artifact, compile la classe et enregistre les jobs dans le `SchedulerManager`.

## Les tâches nommées

Une méthode `@Task("name")` est une tâche que vous pouvez déclencher de plusieurs façons :

### Exécution immédiate (in-process)

```typescript
import { SchedulerManager } from "raiton/core"

const result = await SchedulerManager.current.dispatch("email:welcome", { to: "a@b.c" })
```

### Mise en file d’attente

```typescript
await SchedulerManager.current.enqueue("email:welcome", { to: "a@b.c" }, { priority: "high" })
```

Le message est poussé sur la file associée (ici `"emails"`). Si la tâche a `consume: true`, un worker la récupère automatiquement dans le processus ; sinon, n’importe quel autre processus branché sur le même backend la traitera.

### Alias

- `trigger(name, payload)` équivaut à `dispatch(name, payload)`

## Options des tâches

Toutes les options sont optionnelles et disponibles sur `@Cron`, `@Every`, `@Timeout` et `@Task` :

| Option | Défaut | Description |
|---|---|---|
| `name` | dérivé | Nom unique du job |
| `queue` | `"default"` | File d’attente cible |
| `timezone` | `"UTC"` | Fuseau horaire des expressions cron |
| `singleton` | `true` | Empêche deux exécutions simultanées du même job |
| `concurrency` | `1` | Nombre de messages consommés en parallèle (workers) |
| `retries` | `0` | Nombre de nouvelles tentatives après échec |
| `retryDelay` | `0` | Délai entre tentatives (ms ou `(attempt) => ms`) |
| `timeout` | — | Délai max (ms) avant échec de l’exécution |
| `catchUp` | `false` | Rejoue un tick manqué après une exécution en cours |
| `enabled` | `true` | Active ou désactive le job |
| `consume` | `false` | Consomme la file en tant que worker |
| `immediate` | `false` | (`@Every` uniquement) exécute une fois au démarrage |
| `priority` | `"normal"` | Priorité du message (`lowest` à `highest`) |
| `data` | — | Données statiques transmises au contexte |

## Le contexte d’exécution

Chaque handler reçoit un `TaskContextInterface` :

```typescript
interface TaskContextInterface<T = any> {
  id: string
  name: string
  queue?: string
  payload?: T
  data?: any
  trigger: "cron" | "interval" | "timeout" | "task"
  attempt: number
  scheduledAt: Date
  startedAt: Date
  scheduler: SchedulerControlInterface
}
```

## Expressions cron

Le parseur supporte le format **5 champs** (`minute heure jour mois jour-de-semaine`) et **6 champs** (`seconde minute heure jour mois jour-de-semaine`) :

- `*` (tout), `?` (tout, pour jour/`dow`)
- listes `1,15,45`, plages `1-5`, pas `*/5` ou `1-5/2`
- noms de mois `JAN`–`DEC` et de jours `SUN`–`SAT`
- macros `@yearly`, `@monthly`, `@weekly`, `@daily`, `@hourly`, `@minutely`, `@secondly`

Exemples :

- `"0 3 * * *"` — chaque jour à 03:00
- `"*/5 * * * * *"` — toutes les 5 secondes
- `"30 9 * * 1-5"` — du lundi au vendredi à 09:30

## Files d’attente et backends

Le backend par défaut est une **file en mémoire**. Pour utiliser un broker externe, enregistrez un backend :

```typescript
import { SchedulerManager, RedisQueueBackend, RabbitMqQueueBackend } from "raiton/core"

// Redis (nécessite `bun add redis`)
SchedulerManager.current.registerBackend("redis", new RedisQueueBackend({ url: "redis://localhost:6379" }))
// RabbitMQ (nécessite `bun add amqplib`)
SchedulerManager.current.registerBackend("rabbitmq", new RabbitMqQueueBackend({ url: "amqp://localhost" }))

// Route une file vers un backend précis
SchedulerManager.current.mapQueue("emails", "redis")
```

Les paquets `redis` et `amqplib` ne sont chargés qu’à la première connexion : le framework reste utilisable sans eux.

### Backend personnalisé

Implémentez l’interface `QueueBackendInterface` et enregistrez votre backend :

```typescript
import { SchedulerManager } from "raiton/core"
import type { QueueBackendInterface } from "raiton/types"

class MyBackend implements QueueBackendInterface {
  readonly name = "my-broker"
  async connect() { /* ... */ }
  async disconnect() { /* ... */ }
  async enqueue(queue, message) { /* ... */ return message.id }
  async dequeue(queue, options) { /* ... */ return [] }
  async acknowledge(queue, receipt) { /* ... */ }
  async reject(queue, receipt, requeue) { /* ... */ }
  async length(queue) { /* ... */ return 0 }
  async purge(queue) { /* ... */ }
}

SchedulerManager.current.mapQueue("jobs", "my-broker")
SchedulerManager.current.registerBackend("my-broker", new MyBackend())
```

## Contrôle du scheduler

```typescript
import { SchedulerManager } from "raiton/core"

const mgr = SchedulerManager.current

mgr.pause("daily-cleanup")     // suspend un job
mgr.resume("daily-cleanup")    // le reprend
mgr.cancel("daily-cleanup")    // le supprime

const jobs = mgr.getJobs()     // état détaillé de tous les jobs
const info = mgr.getJob("daily-cleanup") // { nextRun, lastRun, runCount, failCount, running, ... }
```

## Configuration globale

```typescript
SchedulerManager.current.configure({
  enabled: true,
  timezone: "UTC",
  defaultQueue: "default",
  maxConcurrentJobs: 100,
  backend: new RedisQueueBackend({ url: "redis://localhost:6379" }),
})
```

## HMR

Les artifacts `*.scheduler.ts` (et variantes) bénéficient du **hot reload** : une modification recharge les jobs sans redémarrer le process.

## Avantages

- API déclarative, typée et sans dépendance externe par défaut
- backends interchangeables (mémoire, Redis, RabbitMQ, sur mesure)
- réutilise l’injection de dépendances et le cycle de vie du framework
- HMR et découverte d’artifacts homogènes avec le reste de Raiton

## Inconvénients

- la file en mémoire est locale au processus (pas de persistance)
- le support Redis/RabbitMQ exige d’installer le paquet correspondant
- pas de file « dead-letter » dédiée : un échec définitif est simplement abandonné

---

[← mcp](mcp.md) | [types →](types.md)
