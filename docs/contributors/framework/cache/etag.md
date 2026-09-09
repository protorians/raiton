# ETag — `Etagger`, `etag()`

**Fichiers :** `source/framework/cache/etag.ts`
**Import :** `import { Etagger, etag, defaultEtagger } from "raiton/framework"`

> **Navigation :** [← README](README.md) | [↑ README](README.md) | [cache.md →](cache.md)

Système **complet et personnalisable** de gestion des ETag. Il permet de :

- calculer un ETag stable depuis le corps sérialisé de la réponse (hachage FNV-1a par défaut) ;
- répondre `304 Not Modified` quand le client déclare posséder la représentation (`If-None-Match`) ;
- choisir un ETag **fort** ou **faible** (`W/"..."`) ;
- remplacer l'algorithme de hachage par un algorithme **personnalisé** ;
- piloter l'en-tête `Cache-Control` automatiquement ;
- exclure certaines requêtes/réponses du calcul.

## `etag(options?)` — middleware prêt à l'emploi

```typescript
app.use(etag({
  weak: false,
  cacheControl: { maxAge: 60 },
}))
```

Le middleware intercepte `context.reply.send`, calcule l'ETag du corps,
pose l'en-tête `ETag`, applique `Cache-Control` et, si `If-None-Match` matche,
répond `304` sans corps.

## `ETagOptions`

| Option | Type | défaut | Description |
|--------|------|--------|-------------|
| `enabled` | `boolean` | `true` | active la génération |
| `weak` | `boolean` | `false` | ETag faible (`W/"..."`) |
| `algorithm` | `(body: string) => string \| Promise<string>` | FNV-1a | hasher personnalisé |
| `cacheControl` | `boolean \| { ... }` | `false` | en-têtes `Cache-Control` automatiques |
| `headerName` | `string` | `'ETag'` | nom de l'en-tête de réponse |
| `skip` | `(context, body) => boolean` | – | exclure une requête/réponse |

### `cacheControl`

- `true` → `no-cache`
- `{ public: true, maxAge: 60 }` → `public, max-age=60`
- `{ noStore: true }` → `private, no-store`

## `Etagger` — utilisation programmatique

```typescript
const etagger = new Etagger({ weak: true, cacheControl: { maxAge: 300 } })

const { tag, body, notModified } = await etagger.evaluate(context, payload)
if (notModified) {
  context.reply.status(304)
  context.reply.send(null)
} else {
  context.reply.send(body)
}
```

### API de `Etagger`

| Méthode | Description |
|---------|-------------|
| `generate(body)` | calcule la valeur d'ETag (`"..."` ou `W/"..."`) |
| `matches(clientTags, tag)` | teste `If-None-Match` (`*` accepté) |
| `evaluate(context, body)` | applique en-têtes + décision 304, renvoie `{ tag, body, notModified }` |
| `static apply(context, body, options?)` | raccourci un seul appel |

## Exemple — hachage personnalisé

```typescript
app.use(etag({ algorithm: async (body) => {
  const bytes = new TextEncoder().encode(body)
  const digest = await crypto.subtle.digest("SHA-1", bytes)
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("")
}}))
```

---

[← README](README.md) | [↑ README](README.md) | [cache.md →](cache.md)
