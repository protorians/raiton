# HTTPS

> **Navigation :** [← security](security.md) | [openapi →](openapi/README.md)

Le module HTTPS permet d'activer le protocole TLS sur le serveur Raiton.
Il prend en charge l'auto-génération de certificats (openssl ou mkcert), le cumul de configurations et la gestion des environnements dev/prod.

## Exemple rapide

```typescript
import "reflect-metadata"
import { ThreadInterface } from "raiton/types"
import { Application } from "raiton/core"
import { RuntimeType } from "raiton/framework"
import { defineHttps } from "raiton/framework"

export default async (thread: ThreadInterface) => {
  const app = new Application({
    port: 5711,
    prefix: "/api",
    https: defineHttps()
  })

  return await thread.setup({
    application: app,
    runtime: RuntimeType.Bun
  }).run()
}
```

`defineHttps()` sans argument active HTTPS en mode `localhost` avec un certificat auto-signé via openssl.
Les certificats sont générés dans `.raiton/certs/` et réutilisés entre les relances.

## Cumuler des configurations

Le champ `https` accepte un tableau de configurations qui sont fusionnées de gauche à droite.
La dernière configuration non-undefined l'emporte.

```typescript
import { defineHttps, httpsLan } from "raiton/framework"

const app = new Application({
  port: 5711,
  https: [
    defineHttps({ port: 5711 }),
    httpsLan(),
  ]
})
```

Cela est utile pour superposer des configs :

| Cas | Syntaxe |
|---|---|
| Config de base + override LAN | `[defineHttps(), httpsLan()]` |
| Config de base + certificats custom | `[defineHttps(), defineHttps({cert, key})]` |
| Dev avec mkcert, prod avec openssl | Conditional array |

La fonction `mergeHttps()` est aussi disponible si vous voulez fusionner manuellement :

```typescript
import { defineHttps, httpsLan, mergeHttps } from "raiton/framework"

const config = mergeHttps(
  defineHttps(),
  httpsLan(),
  { enabled: true, environment: 'localhost', generator: 'openssl', autoGenerate: true }
)
```

## Les 3 environnements

| Environnement | Usage | Certificat |
|---|---|---|
| `localhost` | Développement local | Auto-signé, généré automatiquement |
| `lan` | Accès depuis un autre appareil du réseau local | Auto-signé avec l'IP LAN comme domaine |
| `production` | Serveur en ligne | Doit être fourni explicitement |

```typescript
import { defineHttps, HttpsEnvironment } from "raiton/framework"

const dev = defineHttps({ environment: HttpsEnvironment.Localhost })
const lan = defineHttps({ environment: HttpsEnvironment.LAN })
const prod = defineHttps({
  environment: HttpsEnvironment.Production,
  certPath: "/etc/ssl/certs/server.pem",
  keyPath: "/etc/ssl/private/server.key",
})
```

## Les 3 presets

Des raccourcis pour les cas courants :

```typescript
import { httpsLocalhost, httpsLan, httpsProduction } from "raiton/framework"

httpsLocalhost()
httpsLan()

httpsProduction({
  cert: fs.readFileSync("./cert.pem", "utf-8"),
  key: fs.readFileSync("./key.pem", "utf-8"),
})
```

## Générateur de certificats : openssl ou mkcert

Par défaut, Raiton utilise `openssl`. Vous pouvez basculer sur `mkcert` pour des certificats approuvés par le navigateur.

```typescript
import { defineHttps, HttpsGenerator } from "raiton/framework"

// Avec openssl (défaut)
defineHttps({ generator: HttpsGenerator.OpenSSL })

// Avec mkcert (certificats de confiance locale)
defineHttps({ generator: HttpsGenerator.Mkcert })
```

### openssl vs mkcert

| | openssl | mkcert |
|---|---|---|
| Installation | Inclus dans la plupart des OS | `brew install mkcert` / `choco install mkcert` |
| Certificat de confiance | Non (avertissement navigateur) | Oui (racine locale installée) |
| Usage | Dev rapide, CI/CD | Dev local, démo clients |

### mkcert : certificats de confiance

`mkcert` installe une autorité de certification locale. Les certificats générés sont approuvés par Chrome, Firefox, Safari, etc. sans avertissement.

```bash
# Installation
brew install mkcert    # macOS
choco install mkcert   # Windows
# ou https://github.com/FiloSottile/mkcert

# mkcert installe automatiquement sa CA locale
mkcert -install
```

```typescript
// Raiton utilise mkcert automatiquement
const app = new Application({
  port: 5711,
  https: defineHttps({ generator: HttpsGenerator.Mkcert })
})
```

## Contrôle de l'auto-génération

Le paramètre `autoGenerate` permet de désactiver la génération automatique de certificats.
Utile si vous voulez que le serveur démarre uniquement avec des certificats fournis.

```typescript
// Ne génère rien, échoue si aucun certificat n'est fourni
defineHttps({
  autoGenerate: false,
  certPath: "./certs/server.pem",
  keyPath: "./certs/server.key",
})

// Génère via mkcert (échoue si mkcert n'est pas installé)
defineHttps({
  autoGenerate: true,
  generator: HttpsGenerator.Mkcert,
})
```

| autoGenerate | generator | Comportement |
|---|---|---|
| `true` (défaut) | `openssl` | Génère via openssl si aucun certificat fourni |
| `true` (défaut) | `mkcert` | Génère via mkcert si aucun certificat fourni |
| `false` | `*` | Ne génère rien, erreur si pas de certificat |
| `true` | `none` | Erreur : pas de générateur sélectionné |

## Fournir des certificats

### Auto-signé (dev/lan)

Aucune configuration nécessaire. Raiton génère le certificat et le stocke dans `.raiton/certs/`.

### Par contenu (string)

```typescript
defineHttps({
  cert: process.env.TLS_CERT!,
  key: process.env.TLS_KEY!,
  ca: process.env.TLS_CA,
})
```

### Par chemin de fichier

```typescript
defineHttps({
  certPath: "./certs/server.pem",
  keyPath: "./certs/server.key",
  caPath: "./certs/ca.pem",
})
```

## Pattern `.env` pour switch dev/prod

```env
# .env
HTTPS_ENABLED=true
HTTPS_CERT_PATH=./certs/fullchain.pem
HTTPS_KEY_PATH=./certs/privkey.pem
HTTPS_GENERATOR=mkcert
```

```typescript
import { defineHttps, HttpsGenerator } from "raiton/framework"

const https = process.env.HTTPS_ENABLED === "true"
  ? defineHttps({
      certPath: process.env.HTTPS_CERT_PATH,
      keyPath: process.env.HTTPS_KEY_PATH,
      generator: process.env.HTTPS_GENERATOR === "mkcert"
        ? HttpsGenerator.Mkcert
        : HttpsGenerator.OpenSSL,
    })
  : undefined

const app = new Application({
  port: 5711,
  https,
})
```

## Bootstrap complet

```typescript
import "reflect-metadata"
import { ThreadInterface } from "raiton/types"
import { Application } from "raiton/core"
import { RuntimeType, Security } from "raiton/framework"
import { defineHttps } from "raiton/framework"

export default async (thread: ThreadInterface) => {
  const app = new Application({
    port: 5711,
    hostname: "0.0.0.0",
    prefix: "/api",
    https: [
      defineHttps(),
      { environment: 'lan', autoGenerate: true },
    ],
  })

  app.register(Security.cors({ origin: "*" }))

  return await thread.setup({
    application: app,
    runtime: RuntimeType.Bun
  }).run()
}
```

Lors du démarrage, les logs affichent :

```
[info] Local access: https://localhost:5711/api
[info] LAN access: https://192.168.1.42:5711/api
[info] HTTPS: enabled (lan)
```

## Compatibilité Bun / Node

Le support HTTPS fonctionne avec les deux runtimes principaux :

- **Bun** — utilise `Bun.serve({ tls: { cert, key } })`
- **Node** — utilise `https.createServer({ cert, key })`

```typescript
// Bun
return await thread.setup({ application: app, runtime: RuntimeType.Bun }).run()

// Node
return await thread.setup({ application: app, runtime: RuntimeType.Node }).run()
```

## Référence API

### `defineHttps(options?)`

| Paramètre | Type | Défaut | Description |
|---|---|---|---|
| `environment` | `HttpsEnvironment` | `localhost` | `localhost`, `lan`, ou `production` |
| `generator` | `HttpsGenerator` | `openssl` | `openssl`, `mkcert`, ou `none` |
| `autoGenerate` | `boolean` | `true` | Générer les certificats automatiquement |
| `cert` | `string` | — | Contenu PEM du certificat |
| `key` | `string` | — | Contenu PEM de la clé privée |
| `ca` | `string` | — | Contenu PEM du certificat CA |
| `certPath` | `string` | — | Chemin vers le fichier certificat |
| `keyPath` | `string` | — | Chemin vers le fichier clé |
| `caPath` | `string` | — | Chemin vers le fichier CA |
| `certDir` | `string` | `.raiton/certs/` | Dossier de stockage des certificats générés |
| `port` | `number` | — | Port HTTPS (optionnel) |

### `mergeHttps(...configs)`

Fusionne plusieurs `HttpsConfigInterface` de gauche à droite. La dernière valeur définie l'emporte.

### `resolveHttpsConfig(input)`

Résout `HttpsConfigInterface | HttpsConfigInterface[]` en une seule config. Utile pour normaliser le champ `https` de l'application.

## Pourquoi utilisé

- sécuriser les échanges entre client et serveur
- respecter les best practices même en développement
- tester en HTTPS localement avant la mise en production
- accès LAN pour tester sur appareils physiques
- mkcert pour des certificats de confiance sans avertissement

## Avantages

- une seule ligne pour activer en dev (`defineHttps()`)
- cumul de configurations via tableau
- choix entre openssl et mkcert
- auto-génération désactivable
- compatible Bun et Node
- granulaire : la configuration peut varier selon l'environnement

## Inconvénients

- `openssl` ou `mkcert` doit être installé pour la génération automatique
- en production, les certificats doivent être fournis explicitement
- les certificats auto-signés (openssl) génèrent un avertissement dans le navigateur
- mkcert nécessite `mkcert -install` pour installer la CA locale

---

[← security](security.md) | [openapi →](openapi/README.md)
