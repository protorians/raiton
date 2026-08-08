# Sockets

> **Navigation :** [← openapi](openapi/README.md) | [tutorial →](tutorial.md)

Les sockets servent à créer des échanges temps réel.

## Exemple

```typescript
import { Socket, OnSocketConnect, OnSocketMessage } from "raiton/framework"

@Socket("/chat")
export class ChatSocket {
  @OnSocketConnect()
  connect() {
    return { connected: true }
  }

  @OnSocketMessage("message")
  message(payload: any) {
    return { ok: true, payload }
  }
}
```

## Pourquoi utilisé

- notifications temps réel
- chat
- synchronisation instantanée

## Comment l’utiliser

- déclarez une classe socket
- ajoutez des handlers avec `@OnSocketConnect()` et `@OnSocketMessage()`

## Avantages

- intégration naturelle avec le runtime Bun
- API simple à déclarer

## Inconvénients

- support plus limité que le HTTP
- dépend du runtime choisi

---

[← openapi](openapi/README.md) | [tutorial →](tutorial.md)
