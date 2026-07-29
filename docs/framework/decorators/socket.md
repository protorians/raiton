# Décorateurs Socket

**Fichier :** `source/framework/decorators/socket.decorator.ts`
**Import :** `import { Socket, OnSocketConnect, OnSocketDisconnect, OnSocketMessage, OnSocketEvent } from "raiton/framework"`

> **Navigation :** [← middleware.md](middleware.md) | [↑ decorators/](README.md) | [openapi.md →](openapi.md)

Les décorateurs socket permettent de définir des handlers pour des événements de websocket.

## `@Socket(namespace?)`

Marque une classe comme handler socket. Le namespace est optionnel (défaut: `"/"`).

```typescript
@Socket("/chat")
export class ChatSocket {
  // ...
}
```

**Fonctionnement interne :**
1. Appelle `@Injectable(LifetimeEnum.TRANSIENT, className)` → enregistre dans le DI
2. Crée les métadonnées via `getSocketMetadata(target.prototype)` et définit le namespace

## `@OnSocketConnect()`

Handler appelé à la connexion d'un client.

```typescript
@Socket("/chat")
export class ChatSocket {
  @OnSocketConnect()
  onConnect() {
    console.log("Client connecté au chat")
  }
}
```

## `@OnSocketDisconnect()`

Handler appelé à la déconnexion.

```typescript
@Socket("/chat")
export class ChatSocket {
  @OnSocketDisconnect()
  onDisconnect() {
    console.log("Client déconnecté du chat")
  }
}
```

## `@OnSocketMessage(name?)`

Handler pour les messages entrants.

```typescript
@Socket("/chat")
export class ChatSocket {
  @OnSocketMessage("message")
  onMessage(data: any) {
    console.log("Message reçu:", data)
    // Répondre...
    // this.send("response", { received: true })
  }
}
```

Si `name` est omis, le nom de la méthode est utilisé.

## `@OnSocketEvent(name)`

Handler pour un événement socket nommé.

```typescript
@Socket("/chat")
export class ChatSocket {
  @OnSocketEvent("typing")
  onTyping(data: { userId: string }) {
    console.log(`${data.userId} est en train d'écrire...`)
  }

  @OnSocketEvent("join")
  onJoin(data: { room: string }) {
    console.log(`Rejoint le salon ${data.room}`)
  }
}
```

## Exemple complet

```typescript
import { Socket, OnSocketConnect, OnSocketDisconnect, OnSocketMessage, OnSocketEvent } from "raiton/framework"

@Socket("/chat")
export class ChatHandler {
  private onlineUsers = new Map<string, string>()

  @OnSocketConnect()
  connected() {
    console.log("Nouvelle connexion au chat")
  }

  @OnSocketDisconnect()
  disconnected() {
    console.log("Déconnexion du chat")
  }

  @OnSocketMessage("message")
  handleMessage(data: { room: string; text: string; user: string }) {
    console.log(`[${data.room}] ${data.user}: ${data.text}`)
    // Diffuser aux autres clients...
  }

  @OnSocketEvent("join")
  joinRoom(data: { room: string; user: string }) {
    this.onlineUsers.set(data.user, data.room)
    console.log(`${data.user} a rejoint ${data.room}`)
  }

  @OnSocketEvent("leave")
  leaveRoom(data: { room: string; user: string }) {
    this.onlineUsers.delete(data.user)
    console.log(`${data.user} a quitté ${data.room}`)
  }
}
```

## Métadonnées socket

Les métadonnées sont stockées via des symboles Reflect (voir `METADATA_KEYS.SOCKET_METADATA`) :

```typescript
interface SocketMetaInterface {
  namespace: string
  events: Array<{
    type: SocketEventType      // "connect" | "disconnect" | "message" | "event"
    name: string               // Nom de l'événement
    propertyKey: string         // Nom de la méthode
  }>
}
```

## Notes

- La fonctionnalité socket est en développement — le runtime sous-jacent est à implémenter
- Les décorateurs stockent les métadonnées mais le traitement effectif dépendra de l'adaptateur socket
- Utilisez `getSocketMetadata(target)` de `source/core/socket/metadata.ts` pour lire les métadonnées

---

[← middleware.md](middleware.md) | [↑ decorators/](README.md) | [openapi.md →](openapi.md)
