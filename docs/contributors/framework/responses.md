# Réponses et Exceptions

**Fichiers :** `source/framework/responses/`, `source/framework/exceptions/`
**Import :** `import { HttpResponse, HttpErrorResponse, ThrowableResponse, RaitonResponses, HttpException, Throwable, throwError, throwException, throwWarning, throwCritical } from "raiton/framework"`

> **Navigation :** [← runtime.md](runtime.md) | [↑ framework/](README.md) | [encryption.md →](encryption.md)

## Réponses

### `HttpResponse`

Réponse HTTP standard avec code statut et en-têtes.

```typescript
import { HttpResponse } from "raiton/framework"

new HttpResponse(200, { data: "ok" })
// Corps : { data: "ok" }, Statut : 200
```

### `HttpErrorResponse`

Réponse d'erreur avec gestion de pile d'erreurs.

```typescript
import { HttpErrorResponse } from "raiton/framework"

const error = new HttpErrorResponse("Erreur de validation", {
  statusCode: 422,
  details: [{ field: "email", message: "Email invalide" }],
})
```

### `ThrowableResponse`

Réponse d'exception. Utilisée en interne par le handler pour détecter les réponses d'erreur.

```typescript
import { ThrowableResponse } from "raiton/framework"

const response = new ThrowableResponse("Resource introuvable", {
  statusCode: 404,
})

// Dans Application.handle(), si le handler retourne un ThrowableResponse :
if (responses instanceof ThrowableResponse) {
  context.reply.status(responses.statusCode ?? 500)
}
```

### `RaitonResponses`

Builder de réponses.

```typescript
import { RaitonResponses } from "raiton/framework"

// Réponse de succès
RaitonResponses.success(data, "Opération réussie", 200)

// Réponse d'échec
RaitonResponses.fail("Erreur", 400)

// Réponse paginée
RaitonResponses.paginated(items, total, page, limit)
```

## Exceptions

### `HttpException`

Exception avec code HTTP. Attrapée par `Application.handle()` pour générer une réponse appropriée.

```typescript
import { HttpException } from "raiton/framework"

// Création
throw new HttpException(404, "Utilisateur non trouvé")

// Dans le handler, l'exception est automatiquement attrapée
// et une réponse 404 est envoyée :
// { statusCode: 404, error: true, message: "Utilisateur non trouvé", data: null }
```

```typescript
@Controllable("/users")
export class UserController {
  @Get("/:id")
  get(@Param("id") id: string) {
    const user = users.find(u => u.id === Number(id))
    if (!user) {
      throw new HttpException(404, "Utilisateur introuvable")
    }
    return user
  }
}
```

### `Throwable`

Exception de base avec helpers statiques.

```typescript
import { Throwable, throwError, throwException, throwWarning, throwCritical } from "raiton/framework"

// Lance une erreur simple
throwError("Quelque chose a mal tourné")

// Lance une exception
throwException("Erreur métier", 422)

// Lance un avertissement
throwWarning("Attention", { detail: "valeur" })

// Lance une erreur critique
throwCritical("Erreur fatale", { code: "FATAL_001" })
```

### Propagation dans le pipeline

Les exceptions sont attrapées à deux niveaux :

1. **Dans le handler de route** — `Application.handle()` → `try/catch` → `reply.send()`
2. **Dans le middleware** — `this.root.middleware.run()` → `try/catch` → `ctx.reply.send()`

```typescript
// Application.handle() extrait :
try {
  await this.root.middleware.run(ctx, handler)
} catch (err) {
  if (err instanceof HttpException || err instanceof ThrowableResponse) {
    ctx.reply.status(err.statusCode ?? 500)
    return ctx.reply.send(err.render())
  }
  ctx.reply.send({
    statusCode: 500,
    error: true,
    message: err.message ?? err,
    data: null,
  })
}
```

## Renvoyer une réponse depuis un contrôleur

Le handler de route peut retourner :
- Un **objet** → automatiquement sérialisé en JSON
- Un **ThrowableResponse** → code statut personnalisé
- Une **instance de classe** → envoyée telle quelle

```typescript
@Controllable("/example")
export class ExampleController {
  @Get("/object")
  object() {
    return { message: "Ceci sera du JSON" }
  }

  @Get("/error")
  error() {
    return new ThrowableResponse("Erreur personnalisée", { statusCode: 400 })
  }

  @Get("/exception")
  exception() {
    throw new HttpException(403, "Accès refusé")
  }

  @Get("/custom")
  custom(@Reply() reply: any) {
    reply.type("text/html")
    reply.status(200)
    reply.send("<h1>Hello</h1>")
  }
}

---

[← runtime.md](runtime.md) | [↑ framework/](README.md) | [encryption.md →](encryption.md)
```
