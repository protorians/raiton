# Configuration

**Fichiers :** `source/core/config/`
**Import :** `import { RaitonConfig, defineConfig } from "raiton/core"`

> **Navigation :** [← plugin-scope.md](plugin-scope.md) | [↑ core/](README.md) | [builder-thread.md →](builder-thread.md)

## `RaitonConfig`

Charge la configuration depuis un fichier `raiton.config.json` ou `raiton.config.js`/`.mjs` situé à la racine du projet.

```typescript
class RaitonConfig {
  static current: Map<keyof ConfigurableInterface, any>
  static get<K>(key: K): ConfigurableInterface[K] | undefined
  static sync(workdir: string): Promise<Map<...>>
}
```

### `RaitonConfig.sync(workdir)`

Charge la configuration de manière asynchrone. Appelée automatiquement par le bootstrapper.

**Ordre de chargement :**

1. Cherche `raiton.config.json` dans le répertoire de travail
2. Si non trouvé, cherche `raiton.config.js` puis `raiton.config.mjs`
3. Fusionne avec la configuration par défaut

**Configuration par défaut :**

```typescript
{
  rootDir: ".",
  version: "0.0.1"
}
```

### `RaitonConfig.get(key)`

```typescript
const rootDir = RaitonConfig.get("rootDir")  // "./" par défaut
const version = RaitonConfig.get("version")  // "0.0.1" par défaut
const port = RaitonConfig.get("port")        // Défini dans le fichier
```

### Fichier JSON (`raiton.config.json`)

```json
{
  "rootDir": "./source",
  "version": "1.0.0",
  "port": 3000,
  "hostname": "0.0.0.0",
  "protocole": "http",
  "pathname": "/",
  "artifacts": {
    "types": ["controller", "socket", "service"]
  }
}
```

### Fichier JS (`raiton.config.js`)

```javascript
export default {
  rootDir: "./source",
  version: "1.0.0",
  port: 3000,
  artifacts: {
    types: ["controller", "socket"],
  },
}
```

## `defineConfig`

Utilitaire pour construire la configuration à partir de `package.json` :

```typescript
import { defineConfig } from "raiton/core"

defineConfig({
  // Inspecte package.json pour extraire version, name, etc.
  rootDir: "./app",
})
```

## Interface `ConfigurableInterface`

```typescript
interface ConfigurableInterface {
  rootDir?: string
  version?: string
  port?: number
  hostname?: string
  protocole?: string
  pathname?: string
  artifacts?: {
    types: string[]
  }
}
```

## Utilisation typique

```bash
.
├── raiton.config.json   ← Configuration Raiton
├── package.json
└── source/              ← rootDir par défaut
```

```typescript
// Le bootstrapper appelle automatiquement :
await RaitonConfig.sync(process.cwd())

// Ensuite, l'application peut lire la config :
const rootDir = RaitonConfig.get("rootDir")  // "./source"
```

---

[← plugin-scope.md](plugin-scope.md) | [↑ core/](README.md) | [builder-thread.md →](builder-thread.md)
