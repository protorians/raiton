# Plugins

> **Navigation :** [← injection](injection.md) | [cli →](cli.md)

Les plugins servent à brancher des fonctionnalités réutilisables à l’échelle de l’application.

## Fonctionnalités couvertes

- [body-parser.md](body-parser.md)
- [security.md](security.md)
- [openapi/README.md](openapi/README.md)

## Vue d’ensemble

Le plus souvent, un projet active :
- le body parser pour lire les requêtes
- les sécurités HTTP de base
- OpenAPI pour documenter l’API

Les plugins sont utiles quand vous voulez :
- centraliser une configuration
- activer une brique une seule fois au bootstrap
- éviter de répéter la même initialisation dans plusieurs contrôleurs

## Pourquoi utilisé

- brancher des comportements transverses sans surcharger les contrôleurs
- garder le bootstrap lisible
- réutiliser une configuration entre plusieurs applications

## Comment l’utiliser

- installez d’abord le plugin concerné
- enregistrez-le au démarrage de l’application
- gardez les effets de bord au plus près du bootstrap

## Exemple

```typescript
import { Security, bodyParserPlugin, openApiPlugin } from "raiton/framework"

app.register({
  plugins: [
    bodyParserPlugin(),
    Security.headers(),
    Security.cors(),
    openApiPlugin({
      route: "/docs",
      endpoint: "/docs/json"
    })
  ]
})
```

## Avantages

- réutilisable
- lisible
- facile à brancher au démarrage
- limite les répétitions

## Inconvénients

- une mauvaise composition peut rendre le bootstrap trop chargé
- trop de plugins peut masquer la logique réelle du démarrage

---

[← injection](injection.md) | [cli →](cli.md)
