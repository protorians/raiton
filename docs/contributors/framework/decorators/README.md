# Décorateurs

**Fichiers :** `source/framework/decorators/`
**Import :** `import { ... } from "raiton/framework"`

> **Navigation :** [← framework/](../README.md) | [↑ framework/](../README.md) | [controllable.md →](controllable.md)

## Table des matières

| Fichier | Description |
|---------|-------------|
| [controllable.md](controllable.md) | `@Controllable`, `@Get`, `@Post`, `@Put`, `@Delete`... |
| [parametrable.md](parametrable.md) | `@Param`, `@Query`, `@Body`, `@Headers`, `@Req`... |
| [injection.md](injection.md) | `@Injectable`, `@Inject` |
| [middleware.md](middleware.md) | `@Middleware` |
| [socket.md](socket.md) | `@Socket`, `@OnSocketConnect`, `@OnSocketMessage`... |
| [openapi.md](openapi.md) | `@ApiTags`, `@ApiOperation`, `@ApiResponse`... |

Les décorateurs utilisent `reflect-metadata` et `experimentalDecorators: true` + `emitDecoratorMetadata: true` dans `tsconfig.json`.

## Tableau récapitulatif

| Décorateur | Cible | Description | Détails |
|-----------|-------|-------------|---------|
| `@Controllable` | Classe | Déclare un contrôleur REST | [Voir](controllable.md) |
| `@Get`/`@Post`/... | Méthode | Route HTTP | [Voir](controllable.md) |
| `@Param`/`@Query`/`@Body`... | Paramètre | Injection de paramètre | [Voir](parametrable.md) |
| `@Injectable` | Classe | Enregistrement DI | [Voir](injection.md) |
| `@Inject` | Constructeur/propriété | Injection de dépendance | [Voir](injection.md) |
| `@Middleware` | Classe/méthode | Middleware sur contrôleur/route | [Voir](middleware.md) |
| `@Socket` | Classe | Handler socket | [Voir](socket.md) |
| `@OnSocket*` | Méthode | Événement socket | [Voir](socket.md) |
| `@ApiTags` | Classe/méthode | Tag OpenAPI | [Voir](openapi.md) |
| `@ApiOperation` | Méthode | Description d'opération | [Voir](openapi.md) |
| `@ApiParam`/`@ApiQuery` | Méthode | Paramètre OpenAPI | [Voir](openapi.md) |
| `@ApiBody` | Méthode | Corps OpenAPI | [Voir](openapi.md) |
| `@ApiSecurity` | Classe/méthode | Sécurité OpenAPI | [Voir](openapi.md) |
| `@ApiResponse` | Méthode | Réponse OpenAPI | [Voir](openapi.md) |
| `@ApiOkResponse` | Méthode | Raccourci 200 | [Voir](openapi.md) |
| `@ApiCreatedResponse` | Méthode | Raccourci 201 | [Voir](openapi.md) |
| `@ApiBadRequestResponse` | Méthode | Raccourci 400 | [Voir](openapi.md) |
| `@ApiUnauthorizedResponse` | Méthode | Raccourci 401 | [Voir](openapi.md) |
| `@ApiForbiddenResponse` | Méthode | Raccourci 403 | [Voir](openapi.md) |
| `@ApiNotFoundResponse` | Méthode | Raccourci 404 | [Voir](openapi.md) |
| `@ApiInternalServerErrorResponse` | Méthode | Raccourci 500 | [Voir](openapi.md) |
| `@RouteInteraction` | Méthode | Description d'interaction | [Voir](openapi.md) |

## Règles générales

1. **`experimentalDecorators` et `emitDecoratorMetadata`** doivent être activés dans `tsconfig.json`
2. **`reflect-metadata`** doit être importé une fois au point d'entrée :
   ```typescript
   import "reflect-metadata"
   ```
3. Les décorateurs de paramètres (`@Param`, `@Query`...) doivent être utilisés **après** le décorateur de route (`@Get`, `@Post`...)
4. L'ordre des décorateurs sur une méthode n'a pas d'importance

---

[← framework/](../README.md) | [↑ framework/](../README.md) | [controllable.md →](controllable.md)
