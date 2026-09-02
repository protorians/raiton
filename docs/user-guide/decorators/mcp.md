# `@McpServer()` et décorateurs MCP

> **Navigation :** [← guard](guard.md) | [README →](README.md)

Les décorateurs MCP servent à définir un serveur **Model Context Protocol** : outils, prompts et ressources accessibles aux clients IA.

## Décorateurs concernés

- `@McpServer()`
- `@McpTool()`
- `@McpPrompt()`
- `@McpResource()`
- `@McpResourceTemplate()`
- `@McpArg()` (alias `@McpArgument()`)

## Pourquoi utilisé

- regrouper une logique exposée aux clients IA dans une classe
- garder une structure cohérente avec les contrôleurs HTTP
- réutiliser l’injection de dépendances

## Comment l’utiliser

- marquez la classe avec `@McpServer({ name, version, path })`
- ajoutez les éléments sur les méthodes
- déclarez les paramètres avec `@McpArg` dans l’ordre des arguments
- si une méthode n’a aucun `@McpArg`, elle reçoit l’objet d’entrée complet en premier argument

## Exemple

```typescript
import { McpServer, McpTool, McpResource, McpArg } from "raiton/framework"

@McpServer({ name: "math", version: "1.0.0", path: "/mcp" })
export class MathServer {
  @McpTool({ name: "add", description: "Additionne deux nombres" })
  add(
    @McpArg("a", "Premier opérande", Number) a: number,
    @McpArg("b", "Second opérande", Number) b: number,
  ) {
    return a + b
  }

  @McpResource({ uri: "config://app", name: "Configuration", mimeType: "application/json" })
  config() {
    return { env: "production" }
  }
}
```

## Options

`@McpServer` accepte `name`, `version`, `description`, `path` et `instructions`.

`@McpResourceTemplate` accepte `uriTemplate`, `name`, `description` et `mimeType` ; les variables `{...}` de l’URI sont transmises à la méthode.

## Avantages

- API déclarative et lisible
- métadonnées de type pour générer automatiquement le schéma des arguments
- pas de serveur séparé : cohabite avec HTTP et sockets

## Inconvénients

- l’inférence de type repose sur le métatype fourni à `@McpArg`
- certains éléments (ex. notifications SSE) restent simples

---

[← guard](guard.md) | [README →](README.md)
