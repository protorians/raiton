# `@Socket()` et décorateurs socket

> **Navigation :** [← middleware](middleware.md) | [api-tags →](api-tags.md)

Les décorateurs socket servent à définir un namespace et des handlers d’événements pour un contrôleur temps réel.

## Décorateurs concernés

- `@Socket()`
- `@OnSocketConnect()`
- `@OnSocketDisconnect()`
- `@OnSocketMessage()`
- `@OnSocketEvent()`

## Pourquoi utilisé

- regrouper les événements temps réel dans une classe
- garder une structure proche des contrôleurs HTTP
- déclarer un namespace explicite

## Comment l’utiliser

- marquez la classe avec `@Socket("/chat")`
- ajoutez les handlers d’événements sur les méthodes
- utilisez `@OnSocketEvent("event-name")` pour cibler un événement précis

## Exemple

```typescript
import { Socket, OnSocketConnect, OnSocketMessage } from "raiton/framework"

@Socket("/chat")
export class ChatSocket {
  @OnSocketConnect()
  connect() {
    return "connected"
  }

  @OnSocketMessage("message")
  onMessage(payload: { text: string }) {
    return payload
  }
}
```

## Avantages

- API temps réel plus lisible
- namespace explicite
- pattern cohérent avec les contrôleurs HTTP

## Inconvénients

- plus difficile à tester qu’un handler classique
- dépend du cycle socket du runtime

---

[← middleware](middleware.md) | [api-tags →](api-tags.md)
