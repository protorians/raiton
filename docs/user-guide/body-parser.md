# Body Parser

> **Navigation :** [← plugins](plugins.md) | [security →](security.md)

Le body parser lit et transforme les données reçues par une requête.

## Ce qu’il gère

- JSON
- form-urlencoded
- multipart/form-data
- texte brut

## Pourquoi utilisé

- accéder facilement à `@Body()`
- traiter des fichiers envoyés par formulaire

## Comment l’utiliser

Le plugin est généralement activé automatiquement, mais vous pouvez le documenter comme partie du flux standard.

```typescript
app.register(bodyParserPlugin())
```

## `@Body()` et DTOs

Le body parser remplit `context.req.body` avec la charge utile parsée. Ensuite,
le routeur instancie le type déclaré sur l’argument `@Body()`. Le DTO doit
hériter de `DataTransferObject`, qui recopie le corps sur l’instance.

```typescript
import { Body, Controllable, Post, DataTransferObject } from "raiton/framework"

class CreateUserDto extends DataTransferObject {
  name!: string
}

@Controllable("/users")
export class UsersController {
  @Post("/")
  create(@Body() payload: CreateUserDto) {
    // payload.name est renseigné
    return payload
  }
}
```

Un `POST` sans corps produit un DTO vide (`{}`) plutôt qu’une erreur, sans
constructeur à écrire dans le DTO.

## Avantages

- rend les payloads utilisables directement dans les contrôleurs
- gère plusieurs formats courants
- DTOs `@Body()` hydratés via `DataTransferObject`

## Inconvénients

- le parsing multipart ajoute du coût
- il faut garder la taille des payloads sous contrôle

---

[← plugins](plugins.md) | [security →](security.md)
