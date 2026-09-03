# Plugin CSRF

**Fichiers :**
- `source/framework/plugins/security/csrf.ts` — Plugin middleware principal
- `source/framework/utilities/csrf.util.ts` — Utilitaire de génération/validation
- `source/framework/decorators/csrf-guard.decorator.ts` — Decorator route-level
- `source/framework/decorators/csrf-token.decorator.ts` — Decorator injection token
- `source/types/csrf.ts` — Types et interfaces

**Import :** `import { Security, CsrfGuard, CsrfToken } from "raiton/framework"`

> **Navigation :** [← security.md](security.md) | [↑ plugins/](README.md)

Le plugin CSRF implémente une protection complète contre les attaques Cross-Site Request Forgery avec deux modes opérationnels et une détection automatique du type de client.

## Architecture

```
source/framework/plugins/security/csrf.ts
  │
  ├── double-submit mode
  │     └── CsrfUtil.generateDoubleSubmitToken(secret)
  │     └── CsrfUtil.validateDoubleSubmitToken(secret, token, ttl)
  │
  ├── synchronizer mode
  │     └── CsrfUtil.createTokenStore(ttl)
  │           ├── .create() → string
  │           ├── .validate(token) → boolean
  │           ├── .revoke(token) → boolean
  │           └── .destroy() → void
  │
  └── client detection
        └── CsrfUtil.isBrowserClient(headers, config)
```

## Types

```typescript
// source/framework/enums/csrf.enum.ts

export enum CSRFModeEnum {
    DOUBLE_SUBMIT = 'double-submit',
    SYNCHRONIZER = 'synchronizer',
}
```

```typescript
// source/types/csrf.ts

interface CsrfOptions {
    mode?: CSRFModeEnum
    secret?: string
    cookieName?: string
    headerName?: string
    ttl?: number
    methods?: string[]
    skipPaths?: string[]
    clientDetection?: CsrfClientDetectionConfig
    cookieOptions?: CsrfCookieOptions
}

interface CsrfClientDetectionConfig {
    headerName?: string      // Défaut: 'X-Client-Type'
    skipClients?: string[]   // Défaut: ['mobile', 'desktop']
}

interface CsrfCookieOptions {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
    path?: string
    domain?: string
    maxAge?: number
}

interface CsrfGuardOptions {
    mode?: CSRFModeEnum
    methods?: string[]
    skipPaths?: string[]
}
```

## Utilitaire CSRF

### `CsrfUtil.generateDoubleSubmitToken(secret)`

Génère un token HMAC-SHA256 signé.

```
Format: timestamp.nonce.signature
Exemple: m1a2b3.c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4.a1b2c3d4...
```

- `timestamp` : Base36 du timestamp actuel
- `nonce` : 16 bytes aléatoires en hex (32 caractères)
- `signature` : HMAC-SHA256 du payload avec le secret

### `CsrfUtil.validateDoubleSubmitToken(secret, token, maxAge?)`

Valide un token double-submit :
1. Vérifie le format (3 parties séparées par `.`)
2. Recalcule la signature HMAC
3. Compare avec `timingSafeEqual` (résistant au timing attack)
4. Vérifie l'âge si `maxAge` est défini

### `CsrfUtil.createTokenStore(ttl)`

Crée un store en mémoire pour le mode synchronizer :
- `create()` : Génère un token aléatoire et le stocke
- `validate(token)` : Vérifie l'existence et la validité
- `revoke(token)` : Supprime un token
- Nettoyage automatique des tokens expirés (interval)

### `CsrfUtil.isBrowserClient(headers, config?)`

Détermine si la requête vient d'un navigateur :
- Si header `X-Client-Type` est dans `skipClients` → `false`
- Si header `Authorization` présent ET pas de cookie CSRF → `false`
- Sinon → `true`

### `CsrfUtil.serializeCookie(name, value, options?)`

Sérialise un cookie avec les attributs de sécurité.

### `CsrfUtil.extractCookieValue(cookieHeader, name)`

Extrait la valeur d'un cookie spécifique depuis l'en-tête `Cookie`.
- Retourne `undefined` si le cookie n'est pas trouvé
- Partagé entre le plugin et le decorator `@CsrfGuard`

### `CsrfUtil.timingSafeEqual(a, b)`

Compare deux chaînes de manière résistante aux attaques par timing.
- Utilise `crypto.timingSafeEqual` de Node.js
- Retourne `false` immédiatement si les longueurs diffèrent
- Partagé entre le plugin et le decorator `@CsrfGuard`

## Plugin Middleware

### Pipeline d'exécution

```
1. Request entrante
   │
   ├── GET/HEAD/OPTIONS
   │     └── Générer token → Set-Cookie → next()
   │
   ├── Méthode non protégée (GET par défaut)
   │     └── next()
   │
   ├── Skip path (ex: /health)
   │     └── next()
   │
   ├── Client non-navigateur (mobile/desktop)
   │     └── next()
   │
   └── Méthode protégée (POST/PUT/PATCH/DELETE)
         │
         ├── Cookie présent + Header présent
         │     ├── Token valide → next()
         │     └── Token invalide → 403 Forbidden
         │
         └── Cookie OU Header manquant
               └── 403 Forbidden (CSRF token missing)
```

### Hooks

Le plugin enregistre un hook `onResponse` qui ajoute le token CSRF dans un cookie `Set-Cookie` pour les requêtes state-changing.

### Stockage du token

Le token est disponible dans `context.state.csrfToken` après le middleware CSRF.

## Decorators

### `@CsrfGuard(options?)`

Decorator qui wrappe le middleware CSRF comme middleware de contrôleur.

**Fichier :** `source/framework/decorators/csrf-guard.decorator.ts`

```typescript
// Utilisation basique
@CsrfGuard()
@Controllable('/api/users')
export class UserController { ... }

// Avec options
@CsrfGuard({
  methods: ['POST', 'DELETE'],
  skipPaths: ['/api/public'],
})
```

### `@CsrfToken()`

Decorator qui ajoute un middleware pour injecter le token CSRF dans le header de réponse.

**Fichier :** `source/framework/decorators/csrf-token.decorator.ts`

```typescript
@CsrfToken()
@Get('/csrf-token')
getCsrfToken() {
  return { message: 'Token injected via header X-CSRF-Token' }
}
```

## Intégration avec le système de plugins

Le plugin suit le pattern `definePlugin` de Raiton :

```typescript
// source/framework/plugins/security/csrf.ts
export const secureCsrf = (opts: CsrfOptions = {}) => {
    return definePlugin((scope) => {
        // 1. Initialiser le store (synchronizer mode)
        // 2. Enregistrer le hook onResponse
        // 3. Enregistrer le middleware CSRF
    }, 'csrf')
}
```

## Intégration avec Security

```typescript
// source/framework/plugins/security/index.ts
export class Security {
    // ...
    static csrf = secureCsrf
}
```

## Dépendances

| Module | Utilisation |
|--------|------------|
| `node:crypto` | HMAC-SHA256, randomBytes, timingSafeEqual |
| `definePlugin` | Création du plugin |
| `RaitonResponses` | Formatage des réponses d'erreur |
| `HttpStatus` | Codes de statut HTTP |

## Ordre d'enregistrement recommandé

```
1. Security.cors              → CORS preflight
2. Security.methodGuard       → Méthodes autorisées
3. Security.csrf              → Protection CSRF (NOVEAU)
4. Security.bodyLimit         → Taille max
5. Security.rateLimit         → Rate limiting
6. Security.headers           → En-têtes de sécurité (automatique)
7. bodyParserPlugin           → Parsing body (automatique)
8. Middleware personnalisés
```

## Notes d'implémentation

### Timing-safe comparison

La comparaison des tokens utilise `crypto.timingSafeEqual` pour éviter les attaques par timing. Si les tokens ont des longueurs différentes, la comparaison retourne `false` immédiatement.

### Nettoyage automatique (synchronizer mode)

Le `TokenStore` utilise un `setInterval` pour nettoyer les tokens expirés. L'interval est configuré avec `unref()` pour ne pas empêcher la fermeture du processus.

### Cookie HttpOnly=false

Le cookie CSRF doit être lisible par le JavaScript côté client pour pouvoir être inclus dans le header `X-CSRF-Token`. C'est pourquoi `httpOnly` est `false` par défaut.

### Secret auto-généré

Si aucun secret n'est fourni, un secret aléatoire de 32 bytes est généré. Ceci est déconseillé en production car le secret change à chaque redémarrage, invalidant tous les tokens existants.

---

[← security.md](security.md) | [↑ plugins/](README.md)
