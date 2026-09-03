# Health-check

> **Navigation :** [← security](security.md) | [https →](https.md)

Les health-checks permettent d'exposer un endpoint de contrôle pour les sondes d'infrastructure (load balancer, orchestrateur, « liveness » / « readiness »). Raiton fournit un endpoint **par défaut** et vous permet de le **personnaliser** grâce à `@HealthCheck()` et `HealthCheckManager`.

## Endpoint par défaut

Sans aucune configuration, Raiton enregistre automatiquement `GET /health` **après** le scan des contrôleurs.

```json
{
  "statusCode": 200,
  "message": "Service is healthy",
  "data": {
    "status": "healthy",
    "timestamp": "2026-09-03T12:00:00.000Z",
    "uptime": 42.1,
    "version": "0.0.0"
  }
}
```

Dès que vous définissez votre propre health-check, le défaut est remplacé.

## Définir un health-check personnalisé

Utilisez `@HealthCheck()` sur une méthode combinée à un décorateur de route.

```typescript
import { Controllable, Get, HealthCheck, HttpStatus, RaitonResponses } from "raiton/framework"

@Controllable()
export class HealthController {
  @Get("/health")
  @HealthCheck({ summary: "État de l'application" })
  check() {
    return RaitonResponses(
      "Service is healthy",
      { status: "healthy" },
      HttpStatus.OK,
      { error: false }
    )
  }
}
```

Vous pouvez renvoyer un code `503 Service Unavailable` dans le cas où l'application est en mauvaise santé.

## Configurer le comportement par défaut

`HealthCheckManager.configure(...)` agit sur le health-check par défaut (et sur les sauts de middleware applicables).

```typescript
import { HealthCheckManager, HttpStatus } from "raiton/framework"

HealthCheckManager.configure({
  path: "/health",
  response: {
    statusCode: HttpStatus.OK,
    message: "All systems operational"
  }
})
```

### Vérifications personnalisées

Ajoutez des vérifications de dépendances pour enrichir la réponse.

```typescript
HealthCheckManager.configure({
  checks: [
    {
      name: "database",
      check: async () => {
        // testez votre connexion
        return { status: "healthy" as const }
      }
    },
    {
      name: "cache",
      check: async () => ({ status: "degraded" as const, message: "cache partiellement disponible" })
    }
  ]
})
```

Les résultats sont agrégés dans `data.checks`. Le statut global est :
- `unhealthy` si au moins une vérification échoue (code `503`)
- `degraded` sinon
- `healthy` par défaut (code `200`)

### Handler entièrement personnalisé

`registerCustomHandler` remplace entièrement la logique de réponse du health-check par défaut.

```typescript
HealthCheckManager.registerCustomHandler((ctx) => {
  return { ok: true, memory: process.memoryUsage() }
})
```

## Types et options

- `HealthCheckManager.configure(config)` : `path`, `response` (`statusCode`, `message`), `checks`.
- `@HealthCheck(options)` : `path`, `tags`, `summary`, `description`, `excludeFromDocs`.
- `HealthCheckCheck` : `{ name, check }` où `check` renvoie `{ status, message? }`.

## Bon usage

- garder le endpoint de santé léger et sans logique métier lourde
- utiliser `checks` pour les dépendances critiques (base de données, cache)
- renvoyer `503` quand l'application ne peut plus traiter de requêtes

---

[← security](security.md) | [https →](https.md)
