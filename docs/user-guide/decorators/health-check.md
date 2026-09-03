# `@HealthCheck()`

> **Navigation :** [← route-interaction](route-interaction.md) | [README →](README.md)

`@HealthCheck()` qualifie un endpoint de contrôleur comme **health-check**. Il marque la méthode avec des métadonnées (`path`, `tags`, `summary`, …) et, combiné à un décorateur de route (`@Get`, `@Post`, …), enregistre le endpoint personnalisé.

Si vous ne définissez **aucun** health-check, Raiton en fournit un **par défaut** sur `GET /health`.

## Pourquoi utilisé

- exposer un point de contrôle pour les sondes d'infrastructure (load balancer, orchestrateur, « liveness » / « readiness »)
- centraliser les vérifications de dépendances (base de données, cache, services externes)
- qualifier clairement une méthode comme endpoint de santé dans le code

## Comment l'utiliser

- placez `@HealthCheck()` sur la méthode d'un contrôleur
- combinez-le avec un décorateur de route pour définir le chemin réel
- personnalisez la réponse globale avec `HealthCheckManager.configure(...)`
- ajoutez des vérifications personnalisées avec `checks`

## Exemple

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

## Health-check par défaut

Si aucun contrôleur ne définit de health-check, Raiton enregistre automatiquement `GET /health` après le scan des contrôleurs. Il renvoie :

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

Dès que vous définissez votre propre endpoint sur le même chemin, le défaut est remplacé.

## Options de `@HealthCheck()`

| Option | Type | défaut | Description |
| ------ | ---- | ------ | ----------- |
| `path` | `string` | `/health` | chemin du endpoint |
| `tags` | `string[]` | `['Health']` | tags pour la documentation |
| `summary` | `string` | – | résumé du endpoint |
| `description` | `string` | – | description détaillée |
| `excludeFromDocs` | `boolean` | `false` | exclure de la documentation |

## Configuration globale

`HealthCheckManager` permet de configurer le comportement par défaut.

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

Les résultats des vérifications sont agrégés dans `data.checks`. Le statut global est :
- `unhealthy` si au moins une vérification échoue (code `503 Service Unavailable`)
- `degraded` sinon
- `healthy` par défaut (code `200`)

## Avantages

- aucun code à écrire pour disposer d'un point de contrôle
- personnalisable par contrôleur ou globalement
- se combine naturellement avec les routes existantes

## Inconvénients

- le health-check par défaut reste minimal (uptime/version) tant que vous n'ajoutez pas de `checks`
- le statut global dépend de la qualité de vos vérifications

---

[← route-interaction](route-interaction.md) | [README →](README.md)
