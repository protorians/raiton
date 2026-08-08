# OpenAPI

> **Navigation :** [← security](../security.md) | [plugin →](plugin.md)

OpenAPI permet de produire un contrat de documentation à partir des routes et des métadonnées déclarées dans votre serveur.

## Pages

- [plugin.md](plugin.md) : enregistrer et configurer le plugin OpenAPI
- [../decorators/README.md](../decorators/README.md) : décrire les routes, paramètres, corps et réponses

## Pourquoi utilisé

- fournir une documentation lisible de l’API
- partager un contrat avec les consommateurs et les outils clients
- garder la documentation proche du code qui définit le comportement réel

## Comment l’utiliser

1. enregistrer le plugin OpenAPI au démarrage de l’application
2. ajouter les décorateurs OpenAPI aux contrôleurs et aux routes importantes
3. exposer l’interface et le JSON de documentation aux équipes concernées

## Exemple complet

```typescript
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  Application,
  Get,
  openApiPlugin
} from "raiton/framework"

@ApiTags("users")
class UserController {
  @Get("/users/:id")
  @ApiOperation({ summary: "Récupérer un utilisateur" })
  @ApiResponse(200, { description: "Utilisateur trouvé" })
  async find() {
    return { id: "user-1" }
  }
}

const app = new Application({ port: 5711, prefix: "/api" })

app.register(openApiPlugin({
  route: "/docs",
  endpoint: "/docs/json",
  title: "Users API",
  version: "1.0.0"
}))
```

## Avantages

- documentation générée automatiquement
- contrat d’API partageable
- cohérence entre implémentation et documentation

## Inconvénients

- les métadonnées doivent être maintenues avec les routes
- une description incomplète produit une documentation incomplète
- l’exposition publique de la documentation doit être contrôlée

---

[← security](../security.md) | [plugin →](plugin.md)
