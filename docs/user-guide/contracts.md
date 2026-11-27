# Contrats schema-first

Une seule définition alimente la validation runtime, les types TypeScript, OpenAPI et le client généré.

## Déclarer un contrat

```ts
import {t} from "raiton/contracts"

export const CreateUser = t.object({
  email: t.string().email(),
  name: t.string().min(2),
  age: t.integer().min(0).optional(),
})

export type CreateUser = t.infer<typeof CreateUser>
```

## Brancher une route

```ts
import {Body, Controllable, Post} from "raiton/framework"
import {Input, Output, t} from "raiton/contracts"

const User = t.object({id: t.string(), name: t.string()})

@Controllable("/users")
export class UsersController {
  @Post("/")
  @Input(CreateUser)
  @Output(User)
  create(@Body() input: CreateUser) {
    return this.users.create(input)
  }
}
```

## Erreur stable

Une entrée invalide n'exécute jamais le handler :

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "Invalid request",
  "statusCode": 400,
  "details": [{"path": "email", "code": "invalid_format", "message": "Expected string to match 'email' format"}],
  "docsUrl": "https://github.com/protorians/raiton/blob/main/docs/user-guide/recipes/contracts.md"
}
```

## Validation de sortie

- `validation.responses: "auto"` (défaut) : active en développement, désactive en production.
- `true` / `false` : force le comportement.
- En développement, un écart retourne `OUTPUT_VALIDATION_ERROR` avec la route et le champ fautif.
- En production, aucun coût n'est ajouté.

## OpenAPI et client

```bash
raiton openapi export --out openapi.json
raiton client --out ./sdk
```

Les schémas d'entrée/sortie OpenAPI proviennent des mêmes `@Input`/`@Output`. Le client généré n'utilise jamais `any` : les schémas inconnus deviennent `unknown`.
