# Commandes CLI

**Fichiers :** `source/commands/`
**Commandes intégrées :** 5 commandes

> **Navigation :** [← cli/](README.md) | [↑ cli/](README.md) | [hmr.md →](hmr.md)

## `develop` / `dev`

Mode développement avec Hot Module Replacement.

```bash
bun raiton develop
bun raiton dev  # alias
```

**Flux d'exécution :**

```typescript
// Ce qu'il se passe :
const builder = new RaitonBuilder(process.cwd(), {
  serve: true,   // Démarre le serveur HTTP
  hmr: true,     // Active le hot reload
})

await builder.prepare()
// → Résout les chemins (source, out, bootstrapper)
// → Active le watcher HMR

await builder.boot()
// → Importe le bootstrapper (main.ts)
// → Crée RaitonThread
// → thread.setup({application})
// → thread.run()
//   → ControllerBuilder.scan()
//   → HTTP Server listen()
//   → Watcher HMR actif
```

**Caractéristiques :**
- Watcher sur le dossier source (récursif)
- Recompilation à chaud des contrôleurs modifiés
- Rechargement des artifacts
- Logs de requêtes en temps réel

```bash
# Exemple de sortie
[HMR] activated
[INFO] Local access: http://localhost:3000/
[INFO] LAN access: http://192.168.1.42:3000/
```

## `build` / `b`

Compile l'application TypeScript.

```bash
bun raiton build
bun raiton b      # alias
bun raiton build --develop   # Mode dev avec debug
bun raiton build --bootstrap # Inclut le fichier bootstrap
```

**Flux d'exécution :**

```typescript
const builder = new RaitonBuilder(process.cwd(), {
  serve: false,
  hmr: false,
})

await builder.boot()
// → Importe le bootstrapper
// → Initialise les contrôleurs
// → builder.build(thread)
//   → execSync(`npx tsc -p tsconfig.json --outDir ${out} --noEmit`)
```

**Résultat :**
- Compilation dans `.raiton/server/` (configurable)
- Utilise `tsconfig.json` du projet
- Génère les fichiers `.js` et `.d.ts`

## `start` / `run`

Démarre l'application en production.

```bash
bun raiton start
bun raiton run   # alias
bun raiton start --develop  # Mode debug
```

**Flux d'exécution :**

```bash
# Équivalent à :
bun run build/bin/index.mjs
```

**Caractéristiques :**
- Pas de HMR
- Performance optimale
- Utilise le build précédemment généré

## `artifact` / `art`

Gestion des artifacts.

```bash
bun raiton artifact --dump        # Affiche les artifacts
bun raiton artifact --create      # Crée un artifact
bun raiton artifact --remove      # Supprime un artifact
bun raiton artifact --clear       # Vide tous les artifacts
```

**Note :** Cette commande est actuellement en développement (stub).

## `grafts`

Génération de typings.

```bash
bun raiton grafts
```

**Note :** Cette commande est actuellement en développement (stub).

## Commandes personnalisées du projet

Vous pouvez ajouter vos propres commandes en créant des fichiers `*.command.*` dans le dossier `commands/` de votre projet :

```bash
# Exemple : commands/seed.command.ts
export default {
  name: "seed",
  description: "Peuple la base de données",
  run: async () => {
    console.log("Seeding...")
  },
}
```

Ces commandes sont automatiquement détectées par `RaitonCommands.harvest()`.

## Scripts npm

```json
{
  "scripts": {
    "dev": "bun run --hot source/bin/index.ts",
    "start": "bun run build/bin/index.mjs",
    "build": "bun build source/bin/index.ts --target=node --format=esm --outfile=build/bin/index.mjs"
  }
}
```

```bash
# Équivalents via npm scripts
npm run dev        # → bun raiton dev
npm run build      # → build via bun bundle
npm run start      # → bun raiton start
```

---

[← cli/](README.md) | [↑ cli/](README.md) | [hmr.md →](hmr.md)
