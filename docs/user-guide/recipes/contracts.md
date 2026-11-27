# Recette — contrats schema-first

**Objectif** : validation, types, OpenAPI et client depuis une seule définition.

**Fichier** (`source/contracts/user.contract.ts`)

```ts
import {t} from "raiton/contracts"

export const CreateUser = t.object({
  email: t.string().email(),
  name: t.string().min(2),
})

export type CreateUser = t.infer<typeof CreateUser>
```

**Route**

```ts
@Controllable("/users")
export class UsersController {
  @Post("/")
  @Input(CreateUser)
  create(@Body() input: CreateUser) {
    return input
  }
}
```

**Commandes**

```bash
curl -i -X POST localhost:5711/api/users -H 'content-type: application/json' -d '{"email":"no","name":"x"}'
raiton openapi export --out openapi.json
raiton client --out ./sdk
raiton contract snapshot --out contract.baseline.json
raiton contract check --baseline contract.baseline.json
```

**Attendu**

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "statusCode": 400,
  "details": [{"path": "email", "code": "invalid_format", "message": "Expected string to match 'email' format"}]
}
```

Le client généré compile en TypeScript strict sans `any`.
