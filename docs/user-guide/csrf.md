# Protection CSRF

> **Navigation :** [← security](security.md) | [middleware →](middleware.md)

La protection CSRF (Cross-Site Request Forgery) empêche les attaques où un site malveillant exploite les cookies de session d'un utilisateur pour effectuer des actions non autorisées en son nom.

## Table des matières

- [Pourquoi CSRF ?](#pourquoi-csrf)
- [Comment ça fonctionne](#comment-ça-fonctionne)
- [Modes de protection](#modes-de-protection)
- [Configuration](#configuration)
- [Intégration frontend (Navigateur)](#intégration-frontend-navigateur)
- [Intégration Mobile / Desktop](#intégration-mobile--desktop)
- [Decorators](#decorators)
- [Sécurité](#sécurité)
- [Dépannage](#dépannage)

---

## Pourquoi CSRF ?

Une attaque CSRF fonctionne ainsi :

1. L'utilisateur se connecte à `https://monapp.com` → le navigateur stocke un cookie de session
2. L'utilisateur visite `https://site-malveillant.com`
3. Ce site contient du code qui envoie une requête à `https://monapp.com/api/transfer`
4. Le navigateur envoie **automatiquement** le cookie de session avec cette requête
5. Le serveur traite la requête comme légitime

La protection CSRF empêche cette attaque en exigeant un **token secret** que le site malveillant ne peut pas lire (grâce à la politique Same-Origin).

---

## Comment ça fonctionne

Raiton utilise un mécanisme de **Double Submit Cookie** ou **Synchronizer Token** :

```
1. Le serveur génère un token CSRF
2. Le token est placé dans un cookie (SameSite=Strict)
3. Le client doit renvoyer le même token dans le header X-CSRF-Token
4. Le serveur compare le cookie et le header
5. Si correspondent → requête traitée
6. Sinon → 403 Forbidden
```

### Pourquoi ça marche ?

Un site malveillant **peut** forcer le navigateur à envoyer des cookies cross-origin, mais il **ne peut PAS** lire les cookies ( Same-Origin Policy ). Sans pouvoir lire le token, il ne peut pas le placer dans le header `X-CSRF-Token`.

---

## Modes de protection

### Mode `double-submit` (Recommandé — Stateless)

Le token est un HMAC-SHA256 signé par le serveur :

```
Token = HMAC-SHA256(secret, timestamp.nonce).signature
```

**Avantages :**
- Pas de stockage côté serveur
- Scalable sur plusieurs instances
- Compatible avec les architectures distribuées

**Inconvénients :**
- Le token est valide pendant toute sa durée de vie (TTL)
- Pas de révocation individuelle possible

### Mode `synchronizer` (Stateful)

Le token est un aléatoire stocké en mémoire côté serveur avec un TTL :

```
Token = randomBytes(32).hex()
Stocké en mémoire avec expiresAt = now + ttl
```

**Avantages :**
- Token unique et jetable
- Révocation possible
- Plus résistant aux attaques par replay

**Inconvénients :**
- Nécessite un stockage en mémoire
- Non distribué (un seul serveur)
- Nettoyage automatique des tokens expirés

---

## Configuration

### Import

```typescript
import { Security } from "raiton/framework"
```

### Configuration minimale

```typescript
app.register(Security.csrf())
```

### Configuration complète

```typescript
app.register(Security.csrf({
  mode: CSRFModeEnum.DOUBLE_SUBMIT,  // CSRFModeEnum.DOUBLE_SUBMIT | CSRFModeEnum.SYNCHRONIZER
  secret: 'mon-secret-ultra-long', // Secret HMAC (min 32 caractères)
  cookieName: '_csrf',             // Nom du cookie (défaut: '_csrf')
  headerName: 'X-CSRF-Token',     // Nom du header (défaut: 'X-CSRF-Token')
  ttl: 3600_000,                   // Durée de vie en ms (défaut: 1 heure)
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],  // Méthodes protégées
  skipPaths: ['/health', '/auth/login'],         // Chemins exclus
  clientDetection: {
    headerName: 'X-Client-Type',   // Header de détection client
    skipClients: ['mobile', 'desktop'],  // Clients exemptés
  },
  cookieOptions: {
    httpOnly: false,               // false = JS peut lire le cookie
    secure: true,                  // true = HTTPS uniquement
    sameSite: 'lax',              // 'strict' | 'lax' | 'none'
    path: '/',
    maxAge: 3600,                  // Durée du cookie en secondes
  }
}))
```

### Import de l'enum

```typescript
import { CSRFModeEnum, Security } from "raiton/framework"

// Utilisation
app.register(Security.csrf({
  mode: CSRFModeEnum.DOUBLE_SUBMIT,
}))
```

### Options détaillées

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `mode` | `CSRFModeEnum` | `CSRFModeEnum.DOUBLE_SUBMIT` | Stratégie CSRF utilisée |
| `secret` | `string` | aléatoire | Secret HMAC pour le mode double-submit |
| `cookieName` | `string` | `'_csrf'` | Nom du cookie contenant le token |
| `headerName` | `string` | `'X-CSRF-Token'` | Nom du header contenant le token |
| `ttl` | `number` | `3600000` | Durée de vie du token en millisecondes |
| `methods` | `string[]` | `['POST','PUT','PATCH','DELETE']` | Méthodes HTTP protégées |
| `skipPaths` | `string[]` | `[]` | Chemins exclus de la protection |
| `clientDetection` | `CsrfClientDetectionConfig` | `{}` | Configuration de détection client |
| `cookieOptions` | `CsrfCookieOptions` | voir ci-dessous | Options du cookie |

### Options du cookie

| Option | Type | Défaut | Description |
|--------|------|--------|-------------|
| `httpOnly` | `boolean` | `false` | Cookie inaccessible au JavaScript |
| `secure` | `boolean` | `false` | Cookie envoyé uniquement en HTTPS |
| `sameSite` | `'strict' \| 'lax' \| 'none'` | `'lax'` | Politique SameSite |
| `path` | `string` | `'/'` | chemin du cookie |
| `domain` | `string` | — | Domaine du cookie |
| `maxAge` | `number` | — | Durée de vie en secondes |

---

## Intégration frontend (Navigateur)

### Étape 1 : Récupérer le token

Le token est automatiquement placé dans le cookie `_csrf` par le serveur. Vous pouvez aussi le récupérer via le header `X-CSRF-Token` dans la réponse.

#### Avec JavaScript natif

```javascript
// Fonction pour lire un cookie
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? match[2] : null
}

// Récupérer le token CSRF
const csrfToken = getCookie('_csrf')
```

#### Avec React

```typescript
// Hook personnalisé
function useCsrfToken() {
  const getCookie = (name: string) => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
    return match ? match[2] : null
  }

  return getCookie('_csrf')
}

// Utilisation
const csrfToken = useCsrfToken()
```

### Étape 2 : Envoyer le token

#### Avec Fetch API

```typescript
const response = await fetch('/api/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCookie('_csrf'),
  },
  body: JSON.stringify({ name: 'test' })
})
```

#### Avec Axios

```typescript
import axios from 'axios'

// Intercepteur automatique
axios.interceptors.request.use(config => {
  const csrfToken = document.cookie
    .match(new RegExp('(^| )_csrf=([^;]+)'))?.[2]

  if (csrfToken && config.method !== 'get') {
    config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})
```

#### Avec jQuery

```typescript
// Configuration globale
$.ajaxSetup({
  beforeSend: function(xhr) {
    const csrfToken = document.cookie
      .match(new RegExp('(^| )_csrf=([^;]+)'))?.[2]
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken)
    }
  }
})
```

### Exemple complet avec SPA

```typescript
// app.ts
async function apiCall(url: string, options: RequestInit = {}) {
  const csrfToken = document.cookie
    .match(new RegExp('(^| )_csrf=([^;]+)'))?.[2]

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken ?? '',
      ...options.headers,
    }
  })
}

// Utilisation
await apiCall('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'Alice' })
})
```

---

## Intégration Mobile / Desktop

Les applications mobiles et desktop utilisent généralement des **Bearer tokens (JWT)** au lieu de cookies. Elles sont automatiquement exemptées de la protection CSRF si elles envoient le header `X-Client-Type`.

### Configuration côté client

#### Application mobile (React Native, Flutter, etc.)

```typescript
// Pas besoin de gérer CSRF !
// Envoyez simplement le JWT dans le header Authorization

const response = await fetch('https://api.monapp.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...',
    'X-Client-Type': 'mobile',  // ← Indique au serveur que c'est un client mobile
  },
  body: JSON.stringify({ name: 'test' })
})
```

#### Application Tauri Desktop

```typescript
// Tauri peut utiliser soit JWT soit cookies

// Option 1 : JWT (recommandé pour Tauri)
const response = await fetch('https://api.monapp.com/data', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'X-Client-Type': 'desktop',
  },
  body: JSON.stringify({ name: 'test' })
})

// Option 2 : Cookies (si Tauri gère des cookies)
// Dans ce cas, envoyez aussi le header X-CSRF-Token
const csrfToken = await invoke('get_csrf_token') // depuis le backend Rust
const response = await fetch('https://api.monapp.com/data', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  },
  body: JSON.stringify({ name: 'test' })
})
```

### Logique de détection côté serveur

Le middleware CSRF détecte automatiquement le type de client :

```
Requête avec cookie + header X-CSRF-Token → Navigation browser → Valider CSRF
Requête avec Authorization + X-Client-Type: mobile → App mobile → Skip CSRF
Requête avec Authorization + X-Client-Type: desktop → App desktop → Skip CSRF
Requête avec cookie mais sans header CSRF → Faille potentielle → 403
```

---

## Decorators

### `@CsrfGuard()`

Applique la protection CSRF sur une classe ou une méthode de contrôleur.

```typescript
import { CsrfGuard, Controllable, Post } from "raiton/framework"

// Protection sur toute la classe
@CsrfGuard()
@Controllable('/api/users')
export class UserController {
  @Post('/')
  create(@Body() data: any) {
    return { created: true }
  }

  @Get('/')
  list() {
    return []  // GET n'est pas protégé par défaut
  }
}
```

#### Options du decorator

```typescript
@CsrfGuard({
  methods: ['POST', 'PUT'],      // Méthodes spécifiques
  skipPaths: ['/api/public'],    // Chemins exclus
})
```

### `@CsrfToken()`

Injecte le token CSRF dans la réponse pour les routes GET.

```typescript
import { CsrfToken, Controllable, Get } from "raiton/framework"

@Controllable('/api/auth')
export class AuthController {
  @CsrfToken()
  @Get('/csrf-token')
  getCsrfToken() {
    // Le token CSRF sera automatiquement ajouté au header X-CSRF-Token
    return { message: 'Token injected via header' }
  }
}
```

### Utilisation combinée

```typescript
@CsrfGuard()
@Controllable('/api/admin')
export class AdminController {
  @CsrfToken()
  @Get('/token')
  getToken() {
    return { message: 'Use this token for state-changing requests' }
  }

  @Post('/settings')
  updateSettings(@Body() data: any) {
    return { updated: true }
  }
}
```

---

## Sécurité

### Bonnes pratiques

1. **Utilisez HTTPS en production** et activez `secure: true` sur les cookies
2. **Configurez SameSite=Strict** si votre app est mono-domaine
3. **Utilisez un secret fort** (minimum 32 caractères) pour le mode double-submit
4. **Ne désactivez pas CSRF** pour les routes qui modifient des données
5. **Exemptez uniquement** les clients qui utilisent des Bearer tokens (JWT)

### Headers de sécurité recommandés

```typescript
// Combiner avec les autres plugins de sécurité
app.register(Security.headers())
app.register(Security.cors({
  origin: 'https://monapp.com',
  credentials: true,
}))
app.register(Security.csrf({
  mode: CSRFModeEnum.DOUBLE_SUBMIT,
  secret: process.env.CSRF_SECRET,
  cookieOptions: {
    secure: true,
    sameSite: 'strict',
  }
}))
app.register(Security.rateLimit({ max: 100, windowMs: 60000 }))
```

### Attaques courantes et protections

| Attaque | Protection Raiton |
|---------|-------------------|
| Cross-Site Request Forgery | Token CSRF dans cookie + header |
| Token theft via XSS | SameSite=Strict empêche l'envoi cross-origin |
| Replay attack | TTL configurable + nonce aléatoire |
| Brute force token | Token de 64 caractères hexadécimaux |
| Man-in-the-middle | Secure=true (HTTPS uniquement) |

---

## Dépannage

### Erreur 403 "CSRF token missing"

**Cause :** Le client envoie un cookie de session mais pas le header `X-CSRF-Token`.

**Solution :**
```javascript
// Ajouter le header à chaque requête POST/PUT/PATCH/DELETE
fetch('/api/data', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': getCookie('_csrf'),
  }
})
```

### Erreur 403 "CSRF token invalid"

**Cause :** Le token dans le cookie ne correspond pas au token dans le header.

**Solutions possibles :**
1. Le token a expiré → Rafraîchissez la page pour obtenir un nouveau token
2. Le cookie a été modifié → Vérifiez que votre JS lit le bon cookie
3. Le header n'est pas envoyé → Vérifiez le nom du header (défaut: `X-CSRF-Token`)

### Erreur 403 sur les apps mobiles

**Cause :** Le client mobile n'envoie pas le header `X-Client-Type`.

**Solution :**
```typescript
// Ajouter le header pour indiquer que c'est un client mobile/desktop
headers: {
  'X-Client-Type': 'mobile',
  'Authorization': `Bearer ${token}`,
}
```

### Le token n'est pas rafraîchitt

**Cause :** Le middleware CSRF ne s'exécute que sur les requêtes GET/HEAD/OPTIONS.

**Solution :** Le token est automatiquement rafraîchi à chaque requête GET. Si vous avez besoin d'un token pour une requête POST, faites d'abord un GET.

### Cookies multiples

**Cause :** Plusieurs middlewares CSRF définissent le même cookie.

**Solution :** Utilisez un seul `Security.csrf()` dans votre application.

---

## Exemple complet

```typescript
import { Application } from "raiton/application"
import { Security, CsrfGuard, CsrfToken, CSRFModeEnum } from "raiton/framework"

const app = new Application({
  port: 3000,
  hostname: '0.0.0.0',
})

// 1. Activer la protection CSRF
app.register(Security.csrf({
  mode: CSRFModeEnum.DOUBLE_SUBMIT,
  secret: process.env.CSRF_SECRET ?? 'change-moi-en-production',
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  skipPaths: ['/health'],
  clientDetection: {
    headerName: 'X-Client-Type',
    skipClients: ['mobile', 'desktop'],
  },
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  }
}))

// 2. Route publique pour obtenir le token
app.get('/csrf-token', (ctx) => {
  return {
    token: ctx.state.csrfToken
  }
})

// 3. Route protégée
app.post('/api/data', (ctx) => {
  return { success: true, data: ctx.state }
})

app.listen(3000)
```

---

[← security](security.md) | [middleware →](middleware.md)
