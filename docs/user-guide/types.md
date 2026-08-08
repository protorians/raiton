# Types

> **Navigation :** [← sockets](sockets.md) | [tutorial →](tutorial.md)

Le package `raiton/types` regroupe les interfaces qui servent à typer le bootstrap, les contrôleurs, le contexte de requête, les middlewares et les plugins.

Cette page ne liste pas tous les types internes du framework. Elle met en avant ceux que vous utiliserez le plus souvent pour construire un serveur d’API typé.

## Pourquoi utilisé

- éviter les objets `any` dans le point d’entrée et les couches métier
- rendre les signatures explicites
- faciliter l’autocomplétion dans l’éditeur
- sécuriser les contrats entre `source/main.ts`, les middlewares et les plugins

## Types principaux

- `ThreadInterface` : orchestration du serveur et démarrage de l’application
- `ApplicationInterface` : instance applicative configurée avec `port`, `prefix` et les routes
- `ContextInterface` : contexte de requête disponible dans les handlers et certains middlewares
- `MiddlewareParametersInterface` : contrat d’entrée d’un middleware fonctionnel
- `PluginInterface` : forme minimale d’un plugin Raiton
- `RouteHandlerCallable` : signature d’un handler de route

## Exemple d’usage

```typescript
import { Application } from "raiton/core"
import { RuntimeType } from "raiton/framework"
import type {
  ThreadInterface,
  ContextInterface,
  MiddlewareParametersInterface,
  PluginInterface
} from "raiton/types"

const loggerPlugin: PluginInterface = {
  name: "logger",
  setup(scope) {
    scope.app.use(async ({ context, next }) => {
      console.log(`${context.req.method} ${context.req.url}`)
      await next()
    })
  }
}

export default async (thread: ThreadInterface) => {
  const app = new Application({
    port: 5711,
    prefix: "/api"
  })

  app.register(loggerPlugin)

  app.get("/health", (ctx: ContextInterface) => {
    ctx.reply.status(200)
    return {
      statusCode: 200,
      error: false,
      message: "OK",
      data: null
    }
  })

  const authMiddleware = async ({ context, next }: MiddlewareParametersInterface) => {
    const token = context.req.headers.get("authorization")

    if (!token) {
      context.reply.status(401)
      return context.reply.send({
        statusCode: 401,
        error: true,
        message: "Unauthorized",
        data: null
      })
    }

    await next()
  }

  app.use(authMiddleware)

  return await thread.setup({
    application: app,
    runtime: RuntimeType.Bun
  }).run()
}
```

## Comment l’utiliser

- importez les types avec `import type` quand ils ne servent qu’à la compilation
- utilisez `ThreadInterface` dans `source/main.ts` pour typer le bootstrap
- utilisez `ContextInterface` dans les handlers si vous voulez typer explicitement le contexte
- utilisez `MiddlewareParametersInterface` pour écrire des middlewares fonctionnels
- utilisez `PluginInterface` pour décrire un plugin réutilisable

## Avantages

- code plus lisible
- moins d’ambiguïté sur les objets manipulés
- meilleure détection d’erreurs au moment du développement
- intégration naturelle avec TypeScript

## Inconvénients

- exposition de plusieurs interfaces peut sembler plus verbeuse au début
- certains types sont internes et ne sont utiles qu’à des cas avancés
- un typage explicite demande un peu plus de discipline dans les signatures

## À retenir

Si vous ne devez retenir que quelques types, partez de `ThreadInterface`, `ApplicationInterface`, `ContextInterface`, `MiddlewareParametersInterface` et `PluginInterface`.
Ils couvrent la plupart des points d’entrée d’une application Raiton.

---

[← sockets](sockets.md) | [tutorial →](tutorial.md)
