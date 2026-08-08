# OpenAPI Plugin

**Fichier :** `source/framework/plugins/openapi.plugin.ts`
**Import :** `import { openApiPlugin } from "raiton/framework"`

> **Navigation :** [← body-parser.md](body-parser.md) | [↑ plugins/](README.md) | [security.md →](security.md)

Génère une spécification OpenAPI 3.0 à partir des métadonnées collectées par les décorateurs OpenAPI (`@ApiOperation`, `@ApiParam`, `@ApiResponse`, etc.).

```typescript
openApiPlugin(options?: OpenApiOptions): PluginInterface
```

## Options

```typescript
interface OpenApiOptions {
  route?: string           // Route pour l'UI (ex: "/docs") — nécessite `ui` function
  ui?: (config, context) => string  // Fonction retournant le HTML de l'UI
  endpoint?: string | false  // Endpoint JSON (ex: "/docs/json") — false pour désactiver
  title?: string           // Titre de l'API (défaut: "API")
  version?: string         // Version (défaut: "1.0.0")
  description?: string     // Description
  termsOfService?: string  // URL des CGU
  contact?: {              // Contact
    name?: string
    url?: string
    email?: string
  }
  license?: {              // Licence
    name?: string
    url?: string
  }
}
```

## Utilisation de base

```typescript
import { openApiPlugin } from "raiton/framework"

app.register(openApiPlugin({
  title: "Mon API REST",
  version: "1.0.0",
  description: "API de gestion des utilisateurs et produits",
  endpoint: "/docs/json",
  contact: {
    name: "Support API",
    email: "api@example.com",
  },
  license: {
    name: "MIT",
    url: "https://opensource.org/licenses/MIT",
  },
}))

// GET /docs/json → retourne la spec OpenAPI 3.0 complète
```

## Avec interface Swagger UI

```typescript
app.register(openApiPlugin({
  title: "Mon API",
  endpoint: "/docs/json",
  route: "/docs",
  ui: (config) => `<!DOCTYPE html>
<html>
<head>
  <title>${config.title}</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '${config.endpoint}',
        domId: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset,
        ],
      })
    }
  </script>
</body>
</html>`,
}))
```

## Ce qui est généré automatiquement

La spec OpenAPI est générée en parcourant toutes les routes enregistrées. Pour chaque route, elle collecte :

### Depuis les décorateurs

- **Paramètres de chemin** `@ApiParam` + `@Param`
- **Paramètres query** `@ApiQuery` + `@Query`
- **Corps de la requête** `@ApiBody` + `@Body`
- **Réponses** `@ApiResponse`, `@ApiOkResponse`, etc.
- **Tags** `@ApiTags`
- **Sécurité** `@ApiSecurity`
- **Opération** `@ApiOperation`

### Depuis TypeScript (fallback)

Si aucun décorateur OpenAPI n'est défini, le système tente d'inférer :

```typescript
// Type de retour (design:returntype) → réponse 200 par défaut
// Paramètres via design:paramtypes et design:paramtypes
```

## Exemple complet avec décorateurs

```typescript
import {
  Controllable, Get, Post, Param, Body, Query,
  ApiTags, ApiOperation, ApiParam, ApiQuery, ApiBody,
  ApiOkResponse, ApiCreatedResponse, ApiNotFoundResponse,
  openApiPlugin,
} from "raiton/framework"

@ApiTags("Produits")
@Controllable("/products")
export class ProductController {
  @Get("/")
  @ApiOperation({ summary: "Liste des produits", description: "Retourne une liste paginée" })
  @ApiQuery("page", { description: "N° de page", type: Number, required: false })
  @ApiOkResponse("Liste des produits", Array, true)
  list(@Query("page") page = "1") {
    return []
  }

  @Get("/:id")
  @ApiOperation({ summary: "Détail d'un produit" })
  @ApiParam("id", { description: "ID produit", type: Number })
  @ApiOkResponse("Produit trouvé", Object)
  @ApiNotFoundResponse("Produit introuvable")
  get(@Param("id") id: string) {
    return { id, name: "Produit" }
  }

  @Post("/")
  @ApiOperation({ summary: "Créer un produit" })
  @ApiBody({ description: "Données du produit", type: Object })
  @ApiCreatedResponse("Produit créé", Object)
  @ApiBadRequestResponse("Données invalides")
  create(@Body() data: any) {
    return { id: 1, ...data }
  }
}

// Dans le bootstrapper :
app.register(openApiPlugin({
  title: "Catalogue API",
  version: "1.0.0",
  endpoint: "/api/docs",
}))
```

## Exemple de spec générée

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Catalogue API",
    "version": "1.0.0"
  },
  "servers": [{ "url": "http://localhost:3000" }],
  "paths": {
    "/products": {
      "get": {
        "tags": ["Produits"],
        "summary": "Liste des produits",
        "parameters": [
          { "name": "page", "in": "query", "schema": { "type": "number" } }
        ],
        "responses": {
          "200": { "description": "Liste des produits", "content": { "application/json": { "schema": { "type": "array", "items": { "type": "string" } } } } }
        }
      },
      "post": {
        "tags": ["Produits"],
        "summary": "Créer un produit",
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "type": "object" } } }
        },
        "responses": {
          "201": { "description": "Produit créé", "content": { "application/json": { "schema": { "type": "object" } } } },
          "400": { "description": "Données invalides" }
        }
      }
    },
    "/products/{id}": {
      "get": {
        "tags": ["Produits"],
        "parameters": [
          { "name": "id", "in": "path", "required": true, "schema": { "type": "number" } }
        ],
        "responses": {
          "200": { "description": "Produit trouvé", "content": { "application/json": { "schema": { "type": "object" } } } },
          "404": { "description": "Produit introuvable" }
        }
      }
    }
  }
}

---

[← body-parser.md](body-parser.md) | [↑ plugins/](README.md) | [security.md →](security.md)
```
