# Réponses

> **Navigation :** [← middleware](middleware.md) | [plugins →](plugins.md)

Raiton peut renvoyer une réponse de plusieurs façons :
- un objet simple
- une exception HTTP
- une réponse structurée

## Réponse simple

Le cas le plus courant est de retourner un objet.

```typescript
@Get("/users")
list() {
  return {
    ok: true,
    service: "raiton-api"
  }
}
```

Pourquoi utilisé
- c’est la forme la plus simple
- le framework sérialise automatiquement en JSON

Avantages
- rapide à écrire
- lisible

Inconvénients
- peu de contrôle sur le format final si l’on ne standardise pas la réponse

## Réponse structurée

Pour des APIs cohérentes, il est utile de standardiser la forme de réponse.

```typescript
return {
  statusCode: 200,
  error: false,
  message: "OK",
  data: {
    id: "1",
    name: "John Doe"
  }
}
```

Pourquoi utilisé
- uniformiser les réponses
- faciliter l’intégration côté frontend

Avantages
- format prévisible
- plus simple à consommer

Inconvénients
- un peu plus verbeux

## Erreurs HTTP

Lorsque la ressource n’existe pas ou qu’une règle métier échoue, renvoyez une erreur explicite.

```typescript
import { HttpException, HttpStatus } from "raiton/framework"

@Get("/:id")
getOne(@Param("id") id: string) {
  if (id !== "1") {
    throw new HttpException("Utilisateur introuvable", HttpStatus.NOT_FOUND)
  }

  return { id: "1", name: "John Doe" }
}
```

## Réponses textuelles ou binaires

Quand il faut renvoyer autre chose que du JSON, utilisez le `reply` brut.

```typescript
@Get("/export")
export(@Reply() reply: any) {
  reply.type("text/csv")
  return reply.send("id,name\n1,John Doe")
}
```

## Conseils

- garder un format de réponse stable
- utiliser les exceptions pour les erreurs métier
- réserver `reply` aux cas où le JSON ne suffit pas

---

[← middleware](middleware.md) | [plugins →](plugins.md)
