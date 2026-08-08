# Variables d'Environnement

**Fichier :** `source/framework/env.ts`
**Import :** `import { env, envGroup } from "raiton/framework"`

> **Navigation :** [← encryption.md](encryption.md) | [↑ framework/](README.md) | [base-classes.md →](base-classes.md)

Accès typé aux variables d'environnement avec valeurs par défaut et validation de type.

## `env(key, defaultValue?, type?)`

```typescript
function env<T = string>(key: string, defaultValue?: T, type?: EnvType): T
```

### Usage simple

```typescript
import { env } from "raiton/framework"

// String (défaut)
const name = env("APP_NAME", "RaitonApp")
// → process.env.APP_NAME ou "RaitonApp"

// Number
const port = env("PORT", 3000, Number)
// → Number(process.env.PORT) ou 3000

// Boolean
const debug = env("DEBUG", false, Boolean)
// → process.env.DEBUG === "true" ou false

// Sans valeur par défaut
const apiKey = env("API_KEY")
// → process.env.API_KEY ou undefined
```

### Avec typage

```typescript
const port: number = env("PORT", 3000, Number)
const debug: boolean = env("DEBUG", false, Boolean)
const host: string = env("HOST", "localhost")
```

## `envGroup(prefix, schema?)`

Regroupe les variables d'environnement par préfixe.

```typescript
import { env, envGroup } from "raiton/framework"

// Récupère toutes les variables DB_*
const dbConfig = envGroup("DB_")
// → { DB_HOST: "localhost", DB_PORT: "5432", DB_NAME: "mydb" }

// Avec mapping de types (si supporté)
const mapped = envGroup("REDIS_")
// → { REDIS_HOST: "localhost", REDIS_PORT: "6379" }
```

## Exemple typique

```typescript
// .env
PORT=3000
DATABASE_URL=postgres://localhost:5432/mydb
REDIS_HOST=localhost
REDIS_PORT=6379
DEBUG=true
SECRET_KEY=my-secret-key

// config.ts
import { env } from "raiton/framework"
import { Application } from "raiton/core"

const app = new Application({
  port: env("PORT", 3000, Number),
  hostname: env("HOST", "0.0.0.0"),
  verbose: env("DEBUG", false, Boolean),
})
```

**Note :** `dotenv` est inclus dans les dépendances — le chargement du fichier `.env` est géré automatiquement ou via le bootstrapper.

---

[← encryption.md](encryption.md) | [↑ framework/](README.md) | [base-classes.md →](base-classes.md)
