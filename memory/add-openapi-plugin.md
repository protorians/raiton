---
name: add-openapi-plugin
description: Add OpenAPI plugin to generate configurable /docs route compatible with openapi.json
metadata:
  type: project
---

This memory records the addition of an OpenAPI plugin to the Raiton framework that automatically generates a Swagger UI interface and JSON OpenAPI specification at a configurable route (default `/docs`).

**Why:**
The project lacked built-in support for API documentation generation. Adding a plugin that introspects the route definitions (including controller decorators for parameters) and serves Swagger UI provides developers with instant API documentation, improving developer experience and API discoverability.

**How to apply:**
To use the plugin, import and register it in your Raiton application:

```typescript
import { Raiton } from 'raiton';
import { openApiPlugin } from 'raiton/framework/plugins';

const app = new Raiton({ /* config */ });
app.register(openApiPlugin({
  title: 'My API',
  version: '1.0.0',
  description: 'API documentation for my service',
  uiRoute: '/docs',        // optional, defaults to '/docs'
  jsonEndpoint: '/docs/json' // optional, defaults to '/docs/json'
}));
```

After registering, start the application and visit `http://<host>:<port>/docs` to view the Swagger UI interface. The raw OpenAPI JSON is available at `http://<host>:<port>/docs/json`.

**Implementation details:**
- Added `getRoutes()` method to `Router` class (`source/core/router/router.ts`) to expose all registered routes.
- Modified `createHandler` in `source/core/router/handler.ts` to attach route metadata (`_raitonMeta`) to each handler, including route meta, controller meta, and controller class (for return type reflection).
- Created `openapi.plugin.ts` in `framework/plugins` that:
  * Registers a GET route for the UI (serving Swagger UI HTML from CDN).
  * Registers a GET route for the JSON endpoint (dynamically generates OpenAPI spec by iterating over routes, extracting parameters from decorator metadata, and inferring response schemas from return types).
  * Uses `RaitonConfig` to derive base URL (protocol, host, port, pathname).
  * Extracts path, query, header parameters from `Parametrable` decorators (Param, Query, Header). Cookie parameter support omitted as no decorator exists.
  * Handles body parameters to generate `requestBody` (basic schema inference from metatype: primitive types map to JSON types, classes treated as objects).
  * Infers response `200` schema from method return type via `reflect-metadata` (`design:returntype`). Handles `Promise<T>` by attempting to extract `T` (simplified to `Object` if generic resolution fails). Primitives and common types (Date) mapped appropriately; custom classes treated as objects.
- Exported the plugin via `framework/plugins/index.ts`.
- Updated `core/router/router.ts` and `core/router/handler.ts` accordingly.

**Features:**
- Automatic route discovery from `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`, `@Head`, `@Options`, `@Trace` decorators.
- Parameter extraction from `@Param`, `@Query`, `@Header`, `@Body` decorators.
- Response schema generation from method return types (supports primitives, Date, arrays, objects).
- Configurable UI and JSON endpoints.
- Integrated with Raiton configuration for dynamic base URL.
- No build step; spec generated on each request.
- Uses CDN-hosted Swagger UI (no extra dependencies).

**Notes:**
- The plugin respects `experimentalDecorators` and `emitMetadata` settings in `tsconfig.json`.
- For advanced use cases (custom response codes, detailed schemas, security schemes), users can extend the plugin or manually define endpoints.
- The generated OpenAPI spec conforms to OpenAPI 3.0 specification.