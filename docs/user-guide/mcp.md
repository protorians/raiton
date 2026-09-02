# MCP (Model Context Protocol)

> **Navigation :** [← sockets](sockets.md) | [types →](types.md)

Raiton permet de créer un serveur **MCP (Model Context Protocol)** facilement, avec des décorateurs, et de le faire coexister avec le serveur HTTP et les sockets sur le même processus et le même port.

## De quoi s’agit-il

MCP est un protocole qui expose des **outils (tools)**, des **prompts** et des **ressources (resources)** à des clients IA (assistants, agents, IDE…). Raiton implémente le transport **Streamable HTTP** : un simple endpoint qui accepte des requêtes JSON-RPC `POST`, identique au reste de l’API.

## Pourquoi utilisé

- exposer une logique applicative existante à des assistants IA
- réutiliser les services et l’injection de dépendances existants
- cohabiter avec les contrôleurs HTTP et les sockets sans serveur séparé
- bénéficier du HMR, des artifacts et d’OpenAPI, comme pour le reste du framework

## Comment l’utiliser

1. Créez un fichier artifact `*.mcp.ts` (reconnu automatiquement)
2. Déclarez une classe avec `@McpServer()`
3. Ajoutez des méthodes avec `@McpTool()`, `@McpPrompt()`, `@McpResource()` ou `@McpResourceTemplate()`
4. Déclarez les paramètres avec `@McpArg()`
5. Le chemin `path` du serveur devient automatiquement accessible en `POST`

## Exemple

```typescript
import { McpServer, McpTool, McpPrompt, McpResource, McpResourceTemplate, McpArg } from "raiton/framework"

@McpServer({ name: "math", version: "1.0.0", path: "/mcp" })
export class MathServer {
  @McpTool({ name: "add", description: "Additionne deux nombres" })
  add(
    @McpArg("a", "Premier opérande", Number) a: number,
    @McpArg("b", "Second opérande", Number) b: number,
  ) {
    return a + b
  }

  @McpPrompt({ name: "resume", description: "Résume un texte" })
  resume(@McpArg("text", "Le texte à résumer", String) text: string) {
    return `Résume le texte suivant :\n\n${text}`
  }

  @McpResource({ uri: "config://app", name: "Configuration", mimeType: "application/json" })
  config() {
    return { env: "production" }
  }

  @McpResourceTemplate({ uriTemplate: "user://{id}", name: "Utilisateur par id" })
  user({ id }: any) {
    return { id, name: `User-${id}` }
  }
}
```

Aucun enregistrement supplémentaire n’est nécessaire : le scanner détecte `*.mcp.ts`, compile la classe, enregistre le serveur dans le registre MCP et ajoute automatiquement les routes `POST /mcp` et `GET /mcp` sur l’application.

## Points d’extensibilité

### Enregistrement manuel

Vous pouvez aussi compiler et enregistrer un serveur MCP explicitement :

```typescript
import { compileMcp } from "raiton/core"

compileMcp(MathServer)
```

### Plugin MCP

Le plugin `mcpPlugin()` permet un montage explicite sur un chemin personnalisé et d’activer le endpoint `GET` :

```typescript
import { app } from "raiton"

app.register(mcpPlugin({ path: "/mcp", enableGet: true }))
```

> Les routes étant normalement auto-générées par la compilation, le plugin est surtout utile lorsque vous gérez vous-même l’enregistrement ou souhaitez un contrôle fin.

## Protocole

Le endpoint répond au protocole MCP sur JSON-RPC 2.0 :

- `initialize` — négociation de la version et des capacités
- `ping` — test de disponibilité
- `tools/list` / `tools/call`
- `prompts/list` / `prompts/get`
- `resources/list` / `resources/templates/list` / `resources/read`
- `logging/setLevel` / `notifications/initialized`

La version du protocole est vérifiée : une version non supportée renvoie `406`. Les réponses utilisent le header `mcp-session-id`.

## HMR

Les fichiers `*.mcp.ts` bénéficient du **hot reload** : une modification recharge le serveur MCP sans redémarrer le process, exactement comme les contrôleurs et les sockets.

## OpenAPI

Les serveurs MCP sont documentés dans le contrat OpenAPI généré, avec une extension `x-mcp` listant outils, prompts et ressources.

## Avantages

- intégration native avec le serveur HTTP existant
- réutilise l’injection de dépendances
- HMR, artifacts et OpenAPI homogènes avec le reste du framework
- aucun serveur ni processus séparé

## Inconvénients

- transport limité au Streamable HTTP (pas de stdio fourni)
- les notifications serveur `GET` (SSE) restent basiques
- le protocole évolue vite, la liste des versions supportées doit être suivie

---

[← sockets](sockets.md) | [types →](types.md)
