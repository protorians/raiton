# Plugins de Sécurité

**Fichiers :** `source/framework/plugins/security/`
**Import :** `import { Security } from "raiton/framework"`

> **Navigation :** [← openapi.md](openapi.md) | [↑ plugins/](README.md)

La classe `Security` regroupe 5 middlewares de sécurité.

```typescript
class Security {
  static headers       // secureHeaders (activé automatiquement)
  static cors          // secureCors(options?)
  static rateLimit     // secureRateLimit(options?)
  static bodyLimit     // secureBodyLimit(options?)
  static methodGuard   // secureMethodGuard(options?)
}
```

## `Security.headers` (automatique)

Ajoute des en-têtes de sécurité HTTP à chaque réponse. Activé automatiquement par `Application.initialize()`.

```typescript
// En-têtes ajoutés :
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

## `Security.cors(options?)`

Middleware CORS configurable.

```typescript
app.use(Security.cors({
  origin: "*",                                 // ou "https://example.com" ou ["https://a.com", "https://b.com"]
  methods: ["GET", "POST", "PUT", "DELETE"],   // Méthodes autorisées
  headers: ["Content-Type", "Authorization"],  // En-têtes autorisés
  credentials: true,                           // Support des cookies cross-origin
  maxAge: 86400,                               // Cache preflight (secondes)
  exposeHeaders: ["X-Request-Id"],             // En-têtes exposés au client
}))
```

### Options `origin`

```typescript
// Toutes les origines (*)
origin: "*"

// Origine spécifique
origin: "https://monapp.com"

// Multiple origines
origin: ["https://app1.com", "https://app2.com"]

// Booléen — reflet de l'origine demandée
origin: true

// Fonction de validation personnalisée
origin: async (origin) => {
  return origin.endsWith(".example.com")
}
```

### Comportement preflight (OPTIONS)

Si la requête est une `OPTIONS` (preflight CORS) :

1. Ajoute `Access-Control-Allow-Methods`
2. Ajoute `Access-Control-Allow-Headers`
3. Si `maxAge` défini, ajoute `Access-Control-Max-Age`
4. Répond avec `204 No Content` (sans passer au handler suivant)

```typescript
// Exemple de réponse OPTIONS :
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```

## `Security.bodyLimit(options?)`

Limite la taille du corps des requêtes.

```typescript
app.use(Security.bodyLimit({
  maxSize: 1024 * 1024,  // 1 MB
}))
```

Utilise `parseBytes` de `source/core/bytes.util.ts` pour accepter des chaînes :

```typescript
// parseBytes("1MB") → 1048576
// parseBytes("500KB") → 512000
```

## `Security.rateLimit(options?)`

Middleware de rate limiting.

```typescript
app.use(Security.rateLimit({
  windowMs: 60 * 1000,      // Fenêtre : 1 minute
  maxRequests: 100,          // 100 requêtes max par fenêtre
}))
```

## `Security.methodGuard(options?)`

Restreint les méthodes HTTP autorisées.

```typescript
app.use(Security.methodGuard({
  methods: ["GET", "POST", "PUT", "DELETE"],  // Méthodes autorisées
}))
```

## Exemple : tout activer

```typescript
import { Security } from "raiton/framework"

// Dans le constructeur de l'Application ou après
app
  .use(Security.cors({
    origin: "https://frontend.example.com",
    credentials: true,
  }))
  .use(Security.bodyLimit({ maxSize: "5MB" }))
  .use(Security.rateLimit({
    windowMs: 60_000,
    maxRequests: 60,
  }))
  .use(Security.methodGuard({
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  }))
```

## Ordre d'enregistrement recommandé

```
1. Security.cors              → CORS preflight
2. Security.methodGuard       → Méthodes autorisées
3. Security.bodyLimit         → Taille max
4. Security.rateLimit         → Rate limiting
5. Security.headers           → En-têtes de sécurité (automatique)
6. bodyParserPlugin           → Parsing body (automatique)
7. Middleware personnalisés
```

---

[← openapi.md](openapi.md) | [↑ plugins/](README.md)
