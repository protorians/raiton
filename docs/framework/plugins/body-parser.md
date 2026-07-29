# Body Parser Plugin

**Fichier :** `source/framework/plugins/body-parser.plugin.ts`
**Import :** `import { bodyParserPlugin } from "raiton/framework"`

> **Navigation :** [← plugins/](README.md) | [↑ plugins/](README.md) | [openapi.md →](openapi.md)

Middleware de parsing automatique du corps des requêtes HTTP. Activé automatiquement par `Application.initialize()`.

```typescript
bodyParserPlugin(): PluginInterface
```

## Formats supportés

| Content-Type | Résultat |
|-------------|----------|
| `application/json` | `req.body` → objet JSON parsé |
| `multipart/form-data` | `req.body` → champs, `req.files` → tous les fichiers, `req.file` → premier fichier |
| `application/x-www-form-urlencoded` | `req.body` → `Record<string, string>` |
| `text/*` | `req.body` → string brute |
| `GET/HEAD` (sans body) | `req.body` = `req.query` (query string parsée) |

## Propriétés résultantes

```typescript
// Après le passage du bodyParserPlugin :
context.req.body    // Corps parsé (objet, Record, string, ou Uint8Array)
context.req.query   // Query string parsée en Record<string, string>
context.req.files   // Fichiers uploadés (multipart) : Record<string, FileInfo>
context.req.file    // Premier fichier uploadé (multipart)

// FileInfo structure :
interface FileInfo {
  name: string
  type: string
  size: number
  lastModified: number
  buffer: Buffer
}
```

## Exemples

### JSON

```typescript
@Controllable("/users")
export class UserController {
  @Post("/")
  create(@Body() data: { name: string; email: string }) {
    // Content-Type: application/json
    // Body: {"name": "Alice", "email": "alice@example.com"}
    // → data = { name: "Alice", email: "alice@example.com" }
    return { success: true, data }
  }
}
```

### Formulaire URL-encodé

```typescript
@Controllaro("/form")
export class FormController {
  @Post("/submit")
  submit(@Body() data: Record<string, string>) {
    // Content-Type: application/x-www-form-urlencoded
    // Body: name=Alice&email=alice@example.com
    // → data = { name: "Alice", email: "alice@example.com" }
    return data
  }
}
```

### Multipart (upload de fichiers)

```typescript
@Controllable("/files")
export class FileController {
  @Post("/upload")
  upload(
    @Body() fields: Record<string, string>,
    @UploadedFile("avatar") file?: {
      name: string
      type: string
      size: number
      buffer: Buffer
    },
  ) {
    // Content-Type: multipart/form-data
    // Fields: { description: "Mon avatar" }
    // File: avatar (fichier image)
    return {
      fileName: file?.name,
      fileSize: file?.size,
      description: fields.description,
    }
  }
}
```

### Query string (GET/HEAD)

```typescript
@Controllable("/search")
export class SearchController {
  @Get("/")
  search(@Query() query: Record<string, string>) {
    // GET /search?q=hello&lang=fr
    // → req.query = { q: "hello", lang: "fr" }
    // → req.body = req.query (car GET)
    return query
  }
}
```

## Accès au body brut

Pour les `Content-Type` non reconnus, le body reste sous forme de `Uint8Array` :

```typescript
@Controllable("/raw")
export class RawController {
  @Post("/data")
  receive(@Req() req: any) {
    if (!req.state.bodyParsed) {
      // Body non parsé → accès en brut
      const rawBody = req.body as Uint8Array
      return { length: rawBody.length }
    }
    return { parsed: req.body }
  }
}

---

[← plugins/](README.md) | [↑ plugins/](README.md) | [openapi.md →](openapi.md)
```
