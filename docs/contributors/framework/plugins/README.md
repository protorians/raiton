# Plugins Intégrés

**Fichiers :** `source/framework/plugins/`
**Import :** `import { bodyParserPlugin, openApiPlugin, Security } from "raiton/framework"`

> **Navigation :** [← framework/](../README.md) | [↑ framework/](../README.md) | [body-parser.md →](body-parser.md)

## Table des matières

| Fichier | Description |
|---------|-------------|
| [body-parser.md](body-parser.md) | Parsing du corps de requête |
| [openapi.md](openapi.md) | Génération de documentation OpenAPI 3.0 |
| [security.md](security.md) | CORS, en-têtes de sécurité, rate-limit, body-limit |

## Liste des plugins

| Plugin | Description | Activé par défaut ? |
|--------|-------------|-------------------|
| `bodyParserPlugin()` | Parse le corps des requêtes (JSON, form, multipart, text) | Oui (automatique) |
| `openApiPlugin(options)` | Génère une spec OpenAPI 3.0 + endpoint JSON | Non |
| `Security.headers` | Middleware d'en-têtes de sécurité HTTP | Oui (automatique) |
| `Security.cors(options)` | Middleware CORS | Non |
| `Security.rateLimit(options)` | Rate limiting | Non |
| `Security.bodyLimit(options)` | Limitation de taille du body | Non |
| `Security.methodGuard(options)` | Restriction des méthodes HTTP | Non |

## Activation automatique

Dans `Application.initialize()` :

```typescript
protected initialize(): this {
  this.register(Security.headers)        // Toujours activé
  this.register(bodyParserPlugin())      // Toujours activé
  return this
}
```

## Documentation détaillée

| Fichier | Description |
|---------|-------------|
| `body-parser.md` | Parsing du corps de requête (JSON, multipart, URL-encoded, text) |
| `openapi.md` | Génération de documentation OpenAPI 3.0 |
| `security.md` | Plugins de sécurité (CORS, headers, rate-limit, body-limit, method-guard) |

---

[← framework/](../README.md) | [↑ framework/](../README.md) | [body-parser.md →](body-parser.md)
