# Réponses d’API

> **Navigation :** [← routes](routes.md) | [example →](example.md)

Une route peut retourner un objet simple ou une réponse plus structurée selon votre convention d’API.

## Pourquoi utilisé

- rendre les erreurs explicites
- standardiser la forme des réponses
- faciliter la consommation côté client

## Comment l’utiliser

- retournez un objet cohérent depuis vos handlers
- incluez un `statusCode` si vous standardisez les sorties
- utilisez les décorateurs OpenAPI quand vous voulez documenter ces statuts

## Exemple

```typescript
import { Controllable, Get, Param } from "raiton/framework"

@Controllable("/users")
export class UsersController {
  @Get("/:id")
  getOne(@Param("id") id: string) {
    if (id !== "1") {
      return {
        error: true,
        statusCode: 404,
        message: "Utilisateur introuvable"
      }
    }

    return {
      error: false,
      statusCode: 200,
      data: { id: "1", name: "John Doe" }
    }
  }
}
```

## Avantages

- contrat lisible
- meilleur support des cas d’erreur
- homogène pour les consommateurs

## Inconvénients

- demande de choisir une convention de réponse
- peut dupliquer des statuts déjà gérés par le framework

---

[← routes](routes.md) | [example →](example.md)
