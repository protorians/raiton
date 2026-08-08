# Plugin OpenAPI

> **Navigation :** [← OpenAPI](README.md) | [décorateurs →](../decorators/README.md)

Le plugin OpenAPI branche la génération de documentation sur l’application Raiton.

## Pourquoi utilisé

Utilisez-le lorsque votre API doit être explorée par des développeurs, testée depuis une interface de documentation ou consommée par des générateurs de clients.

## Comment l’utiliser

Enregistrez le plugin pendant le bootstrap, généralement dans `source/main.ts` :

```typescript
import { Application, openApiPlugin } from "raiton/framework"

const app = new Application({
  port: 5711,
  prefix: "/api"
})

app.register(openApiPlugin({
  route: "/docs",
  endpoint: "/docs/json",
  title: "Users API",
  version: "1.0.0"
}))
```

`route` désigne la page de documentation et `endpoint` le point d’accès au document JSON. Le titre et la version apparaissent dans les informations du contrat.

## Décrire les routes

Le plugin exploite les métadonnées ajoutées avec les décorateurs :

```typescript
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  Get
} from "raiton/framework"

@ApiTags("users")
class UserController {
  @Get("/users")
  @ApiOperation({ summary: "Lister les utilisateurs" })
  @ApiResponse(200, { description: "Liste retournée" })
  list() {
    return []
  }
}
```

Consultez l’[index des décorateurs](../decorators/README.md) pour documenter les paramètres, les corps de requête et les réponses d’erreur.

## Avantages

- activation centralisée au démarrage
- documentation compatible avec l’écosystème OpenAPI
- séparation entre la configuration du plugin et les métadonnées des routes

## Inconvénients

- l’API documentée peut diverger si les décorateurs ne sont pas mis à jour
- une configuration publique peut révéler des endpoints internes
- les schémas complexes demandent davantage de métadonnées

---

[← OpenAPI](README.md) | [décorateurs →](../decorators/README.md)
