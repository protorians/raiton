# `@Scheduler()` et décorateurs de tâches

> **Navigation :** [← mcp](mcp.md) | [README →](README.md)

Les décorateurs de scheduler servent à déclarer des jobs planifiés et des tâches nommées, exécutés par le `SchedulerManager`.

## Décorateurs concernés

- `@Scheduler()`
- `@Cron()`
- `@Every()` (alias `@Interval()`)
- `@Timeout()`
- `@Task()`

## Pourquoi utilisé

- planifier des travaux récurrents ou différés de façon déclarative
- déclarer des tâches exécutables à la demande ou via une file d’attente
- garder une structure proche des contrôleurs et réutiliser l’injection

## Comment l’utiliser

- marquez la classe avec `@Scheduler({ name, queue })`
- planifiez une méthode avec `@Cron("0 3 * * *")`, `@Every("5m")` ou `@Timeout("30s")`
- déclarez une tâche nommée avec `@Task("name", { consume: true })`
- le scheduler démarre automatiquement au lancement de l’application

## Exemple

```typescript
import { Scheduler, Cron, Every, Task } from "raiton/framework"
import type { TaskContextInterface } from "raiton/types"

@Scheduler({ name: "jobs", queue: "default" })
export class JobsScheduler {
  @Cron("*/10 * * * * *", { name: "poll" })
  async poll(ctx: TaskContextInterface) {
    // toutes les 10 secondes
  }

  @Every("1m", { name: "metrics" })
  async metrics() {
    // toutes les minutes
  }

  @Task("report:generate", { consume: true, retries: 3 })
  async generate(ctx: TaskContextInterface<{ id: string }>) {
    // tâche nommée, dispatchable et consommable
  }
}
```

## Options

Toutes les décorateurs de méthode acceptent `name`, `queue`, `timezone`, `singleton`, `concurrency`, `retries`, `retryDelay`, `timeout`, `catchUp`, `enabled`, `consume`, `priority` et `data`.

- `@Cron(expression, options)` — `expression` est une expression cron 5 ou 6 champs (ou une macro `@daily`, `@hourly`…)
- `@Every(interval, options)` — `interval` est un nombre (ms) ou une durée `"5s"`, `"1m30s"`, `"2h"`
- `@Timeout(delay, options)` — `delay` est un nombre (ms) ou une durée `"30s"`
- `@Task(name, options)` — `name` est le nom unique de la tâche

## Avantages

- API déclarative et lisible
- options riches (retries, timeout, concurrence, singleton)
- cohérente avec les contrôleurs, sockets et serveurs MCP

## Inconvénients

- l’exécution planifiée dépend du processus en cours (pas de persistance sans backend externe)
- les retries et le timeout s’appliquent par exécution, pas par file

---

[← mcp](mcp.md) | [README →](README.md)
