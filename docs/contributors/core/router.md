# Système de Routage

**Fichiers :** `source/core/router/`
**Import :** `import { Router, Route, RouteMatcher, createHandler } from "raiton/core"`

> **Navigation :** [← application.md](application.md) | [↑ core/](README.md) | [middleware.md →](middleware.md)

## `Router`

Enregistre et recherche des routes. Utilisé en interne par `PluginScope`.

```typescript
const router = new Router()

// Ajouter une route
const route = router.add("GET", "/users/:id", handler, "v1")

// Rechercher une route
const match = router.match("GET", "/users/42")
// → { route, parameters: { id: "42" } } ou null
```

### Méthodes

| Méthode | Description |
|---------|-------------|
| `add(method, path, handler, version?)` | Ajoute et retourne une `Route` |
| `match(method, path)` | Cherche une route, retourne `{ route, parameters }` ou `null` |
| `getRoutes()` | Retourne toutes les routes enregistrées (utilisé par OpenAPI) |

## `Route`

Représente une route individuelle.

```typescript
class Route {
  method: HttpMethod
  path: string
  handler: Function
  version?: string
}
```

## `RouteMatcher`

Moteur de matching avec support des paramètres d'URL.

```typescript
const matcher = new RouteMatcher()

matcher.add(route1)
const result = matcher.lookup("GET", "/users/42")
// result === { route: Route, parameters: { "0": "42" } } | null
```

**Règles de matching :**

- Segments statiques : `/users/list` → match exact
- Paramètres nommés : `/users/:id` → capture `{ "0": "42" }`
- La priorité va aux routes statiques puis aux routes avec paramètres
- Les paramètres sont indexés par position (`"0"`, `"1"`, ...) et mappés au handler via `handler.utils.ts`

## `createHandler`

Wrapper qui prépare un handler de contrôleur pour l'exécution :

```typescript
const wrappedHandler = createHandler(instance, routeMeta, controllerMeta)
// Le handler résultant :
// 1. Collecte les arguments depuis le contexte (req, reply, params, body...)
// 2. Valide les DTO si présents
// 3. Appelle la méthode du contrôleur
// 4. Valide la réponse (ViewModel)
```

### Collecte des arguments (`handler.utils.ts`)

Le système lit les métadonnées `@Param`, `@Query`, `@Body`, etc. pour injecter automatiquement les bons paramètres dans la méthode du contrôleur.

```typescript
// Exemple de ce que createHandler produit en interne :
async function handler(context: any) {
  const args = collectArguments(routeMeta, context)
  // args = [42, "Jean"] si la méthode a @Param("id") et @Query("name")
  return await instance[routeMeta.propertyKey](...args)
}
```

## Exemple de routage manuel

```typescript
import { Application, Router, RouteMatcher } from "raiton/core"
import { HttpMethod } from "raiton/framework"

const app = new Application({ port: 3000 })

// Via l'application
app.route(HttpMethod.GET, "/items/:id", async (ctx) => {
  const id = ctx.params?.id || ctx.req.param("id")
  return { id, name: "Item " + id }
})

// Via le router directement (usage avancé)
const router = new Router()
const route = router.add("GET", "/custom", handler)
```

## Matching avec préfixe et pathname

L'`Application.handle()` applique ces transformations avant le matching :

1. Si `config.pathname` est défini (ex: `/app`), il est retiré du début du path.
2. Si `config.prefix` est défini (ex: `/api`), il est ajouté automatiquement dans `Application.route()`.

```typescript
new Application({ prefix: "/api", pathname: "/app" })
// GET /app/api/users/42 → pathname résolu: /users/42 → route /users/:id
```

---

[← application.md](application.md) | [↑ core/](README.md) | [middleware.md →](middleware.md)
