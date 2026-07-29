# Décorateurs de Paramètres

**Fichier :** `source/framework/decorators/parametrable.decorator.ts`
**Import :** `import { Param, Query, Body, Headers, Cookie, Req, Reply, UploadedFile, Parametrable } from "raiton/framework"`

> **Navigation :** [← controllable.md](controllable.md) | [↑ decorators/](README.md) | [injection.md →](injection.md)

Ces décorateurs injectent des parties de la requête dans les paramètres de la méthode du contrôleur.

## `@Param(name?)`

Extrait un paramètre d'URL (segment dynamique dans le chemin) :

```typescript
@Controllable("/users")
export class UserController {
  @Get("/:id")
  get(@Param("id") id: string) {
    return { id }
  }

  @Get("/:organization/:project")
  getProject(
    @Param("organization") org: string,
    @Param("project") project: string,
  ) {
    return { org, project }
  }
}
```

## `@Query(name?)`

Extrait un paramètre de la query string (`?key=value`) :

```typescript
@Controllable("/users")
export class UserController {
  @Get("/")
  list(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search?: string,
  ) {
    // GET /users?page=2&limit=20&search=alice
    // → page="2", limit="20", search="alice"
    return { page, limit, search }
  }
}
```

**Sans nom explicite** — reçoit l'objet complet :

```typescript
@Controllable("/search")
export class SearchController {
  @Get("/")
  search(@Query() query: Record<string, string>) {
    // GET /search?q=hello&lang=fr
    // → query = { q: "hello", lang: "fr" }
    return query
  }
}
```

## `@Body()`

Injecte le corps de la requête. Dépend du `bodyParserPlugin` (activé automatiquement).

```typescript
@Controllable("/users")
export class UserController {
  @Post("/")
  create(@Body() data: { name: string; email: string }) {
    // POST /users avec JSON {"name": "Alice", "email": "alice@example.com"}
    // → data = { name: "Alice", email: "alice@example.com" }
    return { success: true, data }
  }
}
```

Avec DTO pour validation automatique :

```typescript
import { DataTransferObject } from "raiton/framework"
import { IsString, IsEmail, IsNotEmpty } from "class-validator"

class CreateUserDto extends DataTransferObject {
  @IsString() @IsNotEmpty()
  name!: string

  @IsEmail()
  email!: string
}

@Controllable("/users")
export class UserController {
  @Post("/")
  create(@Body() data: CreateUserDto) {
    // data est automatiquement validé via class-validator
    return { success: true, data }
  }
}
```

## `@Headers(name?)`

Extrait un en-tête HTTP :

```typescript
@Controllable("/auth")
export class AuthController {
  @Get("/me")
  me(@Headers("authorization") token: string) {
    // GET /auth/me avec en-tête "Authorization: Bearer xxx"
    // → token = "Bearer xxx"
    return { token }
  }
}
```

**Sans nom explicite** — reçoit tous les en-têtes :

```typescript
@Controllable("/debug")
export class DebugController {
  @Get("/headers")
  headers(@Headers() headers: Record<string, string>) {
    return headers
  }
}
```

## `@Cookie(name?)`

Extrait un cookie spécifique :

```typescript
@Controllable("/session")
export class SessionController {
  @Get("/")
  get(@Cookie("sessionId") sessionId: string) {
    return { sessionId }
  }
}
```

## `@Req()`

Injecte l'objet requête brut (wrapper natif) :

```typescript
import type { RequestInterface } from "raiton/types"

@Controllable("/debug")
export class DebugController {
  @Get("/req")
  debug(@Req() req: RequestInterface) {
    return {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers),
    }
  }
}
```

## `@Reply()`

Injecte l'objet réponse brut (wrapper natif) :

```typescript
import type { ReplyInterface } from "raiton/types"

@Controllable("/custom")
export class CustomController {
  @Get("/download")
  download(@Reply() reply: ReplyInterface) {
    reply.type("application/pdf")
    reply.header("Content-Disposition", "attachment; filename=doc.pdf")
    reply.send(Buffer.from("PDF content"))
  }
}
```

## `@UploadedFile(name?)`

Extrait un fichier uploadé (via `multipart/form-data`) :

```typescript
@Controllable("/files")
export class FileController {
  @Post("/upload")
  upload(@UploadedFile("avatar") file: { name: string; type: string; size: number; buffer: Buffer }) {
    // POST /files/upload avec FormData { avatar: <fichier> }
    return {
      name: file.name,
      type: file.type,
      size: file.size,
    }
  }

  @Post("/upload-multiple")
  uploadMultiple(@UploadedFile() files: Record<string, any>) {
    // Tous les fichiers uploadés
    return files
  }
}
```

## Utilisation combinée

```typescript
@Controllable("/posts")
export class PostController {
  @Post("/:id/comment")
  addComment(
    @Param("id") postId: string,
    @Body() comment: { text: string },
    @Query("notify") notify?: string,
    @Headers("authorization") auth?: string,
    @Cookie("locale") locale?: string,
  ) {
    return { postId, comment, notify, auth, locale }
  }
}
```

## Enum `Parametrable`

```typescript
enum Parametrable {
  PARAM = "param",
  BODY = "body",
  QUERY = "query",
  HEADER = "header",
  COOKIE = "cookie",
  REQ = "req",
  REPLY = "reply",
  UPLOAD_FILE = "upload_file",
  CUSTOM = "custom",
}

Utilisé en interne par les décorateurs pour stocker les métadonnées.

---

[← controllable.md](controllable.md) | [↑ decorators/](README.md) | [injection.md →](injection.md)
