# Décorateurs OpenAPI

**Fichiers :** `source/framework/decorators/api.decorator.ts`, `api-response.decorator.ts`, `route-interaction.decorator.ts`
**Import :** `import { ApiTags, ApiOperation, ApiSecurity, ApiBody, ApiParam, ApiQuery, ApiResponse, ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiInternalServerErrorResponse, RouteInteraction } from "raiton/framework"`

> **Navigation :** [← socket.md](socket.md) | [↑ decorators/](README.md) | [plugins/ →](../plugins/README.md)

Ces décorateurs ajoutent des métadonnées utilisées par `openApiPlugin()` pour générer une spécification OpenAPI 3.0.

## Configuration du tag et sécurité

### `@ApiTags(...tags)`

Ajoute des tags de regroupement (classe ou méthode) :

```typescript
@ApiTags("Utilisateurs")
@Controllable("/users")
export class UserController {
  @Get("/")
  @ApiTags("Liste")  // Tags additionnels pour cette route
  list() { return [] }

  @Get("/:id")
  get(@Param("id") id: string) { return { id } }
}
```

### `@ApiSecurity({name, scopes?})`

Définit le schéma de sécurité (classe ou méthode) :

```typescript
@ApiSecurity({ name: "bearerAuth" })  // Appliqué à toutes les routes
@Controllable("/admin")
export class AdminController {
  @Get("/")
  list() { return [] }

  @Get("/public")
  @ApiSecurity({ name: "none" })  // Surcharge pour cette route
  publicInfo() { return { info: "public" } }
}
```

## Définition de l'opération

### `@ApiOperation({summary, description, operationId, deprecated})`

Métadonnées de l'opération OpenAPI :

```typescript
@Controllable("/users")
export class UserController {
  @Get("/:id")
  @ApiOperation({
    summary: "Récupère un utilisateur",
    description: "Retourne les détails d'un utilisateur par son ID",
    operationId: "getUserById",
    deprecated: false,
  })
  get(@Param("id") id: string) { return { id } }
}
```

## Paramètres

### `@ApiBody({description, required, type})`

Définit le corps de la requête :

```typescript
@Controllable("/users")
export class UserController {
  @Post("/")
  @ApiBody({
    description: "Données de l'utilisateur",
    required: true,
    type: Object,
  })
  create(@Body() data: any) { return data }

  @Post("/batch")
  @ApiBody({
    description: "Liste d'utilisateurs",
    required: true,
    type: Array,
  })
  createBatch(@Body() data: any[]) { return data }
}
```

### `@ApiParam(name, options)`

Définit un paramètre de chemin dans la spec OpenAPI :

```typescript
@Controllable("/users")
export class UserController {
  @Get("/:id")
  @ApiParam("id", {
    description: "ID de l'utilisateur",
    required: true,
    type: Number,
  })
  get(@Param("id") id: string) { return { id } }
}
```

### `@ApiQuery(name, options)`

Définit un paramètre de query string :

```typescript
@Controllable("/users")
export class UserController {
  @Get("/")
  @ApiQuery("page", { description: "Numéro de page", required: false, type: Number })
  @ApiQuery("limit", { description: "Résultats par page", required: false, type: Number })
  @ApiQuery("search", { description: "Recherche", required: false, type: String })
  list(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search?: string,
  ) {
    return { page, limit, search }
  }
}
```

## Réponses

### `@ApiResponse({status, description, type, isArray})`

Définit une réponse OpenAPI générique :

```typescript
@Controllable("/users")
export class UserController {
  @Get("/:id")
  @ApiResponse({ status: 200, description: "Utilisateur trouvé", type: Object })
  @ApiResponse({ status: 404, description: "Utilisateur non trouvé" })
  get(@Param("id") id: string) {
    const user = users.find(u => u.id === Number(id))
    if (!user) throw new HttpException(404, "Non trouvé")
    return user
  }
}
```

### Raccourcis de réponses

```typescript
@Controllable("/users")
export class UserController {
  @Post("/")
  @ApiCreatedResponse("Utilisateur créé avec succès", Object)
  @ApiBadRequestResponse("Données invalides")
  create(@Body() data: any) { return data }

  @Get("/:id")
  @ApiOkResponse("Détails de l'utilisateur", Object)
  @ApiNotFoundResponse("Utilisateur introuvable")
  @ApiUnauthorizedResponse("Non authentifié")
  @ApiForbiddenResponse("Accès refusé")
  @ApiInternalServerErrorResponse("Erreur serveur")
  get(@Param("id") id: string) {
    return { id }
  }
}
```

### `@RouteInteraction(description)`

Décrit une interaction de route (utilisé pour la documentation) :

```typescript
@Controllable("/users")
export class UserController {
  @Get("/:id")
  @RouteInteraction("Récupère un utilisateur par son identifiant unique")
  get(@Param("id") id: string) { return { id } }
}
```

## Exemple complet

```typescript
import {
  Controllable, Get, Post, Param, Body, Query,
  ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody,
  ApiOkResponse, ApiCreatedResponse, ApiBadRequestResponse, ApiNotFoundResponse,
} from "raiton/framework"

@ApiTags("Produits")
@Controllable("/products")
export class ProductController {
  @Get("/")
  @ApiOperation({ summary: "Liste tous les produits", description: "Retourne une liste paginée de produits" })
  @ApiQuery("page", { description: "Page", required: false, type: Number })
  @ApiQuery("category", { description: "Filtre par catégorie", required: false, type: String })
  @ApiOkResponse("Liste des produits", Array, true)
  list(
    @Query("page") page: string = "1",
    @Query("category") category?: string,
  ) {
    return []
  }

  @Get("/:id")
  @ApiOperation({ summary: "Détail d'un produit" })
  @ApiParam("id", { description: "ID du produit", required: true, type: Number })
  @ApiOkResponse("Produit trouvé", Object)
  @ApiNotFoundResponse("Produit introuvable")
  get(@Param("id") id: string) {
    return { id, name: "Produit " + id }
  }

  @Post("/")
  @ApiOperation({ summary: "Crée un nouveau produit" })
  @ApiBody({ description: "Données du produit", required: true, type: Object })
  @ApiCreatedResponse("Produit créé", Object)
  @ApiBadRequestResponse("Données invalides")
  create(@Body() data: any) {
    return { id: 1, ...data }
  }
}
```

## Utilisation avec `openApiPlugin()`

Les métadonnées accumulées par ces décorateurs sont exploitées par le plugin OpenAPI :

```typescript
import { openApiPlugin } from "raiton/framework"

app.register(openApiPlugin({
  title: "Catalogue API",
  version: "2.0.0",
  description: "API de gestion de catalogue produits",
  endpoint: "/docs/json",
}))
```

## Notes

- Les décorateurs fonctionnent avec `reflect-metadata` — l'import est requis au point d'entrée
- Les données sont stockées via `METADATA_KEYS` (symboles) dans `source/framework/constants/decorators.constant.ts`
- La génération du schéma utilise `generateOpenApiSpec(scope, opts)` de `source/framework/utilities/openapi.utils.ts`
- Les types supportés : `String`, `Number`, `Boolean`, `Object`, `Array`, `Date`

---

[← socket.md](socket.md) | [↑ decorators/](README.md) | [plugins/ →](../plugins/README.md)
