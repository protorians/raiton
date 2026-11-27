# Commandes CLI

**Fichiers :** `source/commands/`
**Commandes intégrées :** 15 commandes

Toutes les commandes de diagnostic, d'inventaire et de génération supportent
`--json`, un mode non interactif et des codes de sortie stables
(`0` succès, `1` usage, `2` prérequis manquant, `3` conflit de fichiers,
`4` échec de diagnostic). Les erreurs exposent
`{ code, message, hint, docsUrl, location? }`.

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

Inventaire des artifacts détectés.

```bash
bun raiton artifact --dump
bun raiton artifact --dump --json
```

## Onboarding, contrats et inventaire

| Commande | Rôle |
|---|---|
| `new <name>` | Crée un projet (`api`, `minimal`, `mcp-agent`) sans prompt ; `--dry-run`, `--force`, `--offline`, `--no-install`. |
| `generate <type> <name>` | Génère `controller`, `service`, `repository`, `dto`, `mcp-tool`, `test` ou `resource`. |
| `routes [--json]` | Liste les routes montées. |
| `inspect [--json]` | Émet le manifeste versionné (routes, DI, config, env, MCP, sources). |
| `why <method> <path>` | Indique le fichier, la ligne, le décorateur et l'artifact d'une route. |
| `doctor [--json] [--fix]` | Diagnostic actionnable (runtime, config, décorateurs, versions, ports, env). |
| `openapi export --out` | Exporte le document OpenAPI depuis les routes et contrats. |
| `client --out` | Génère un client TypeScript typé sans `any`. |
| `contract check --baseline` | Détecte les ruptures de contrat (route + champ). |
| `contract snapshot --out` | Écrit une baseline de contrat. |
| `mcp list\|inspect\|test\|serve\|conformance` | Outils MCP, transport HTTP et stdio. |
| `docs agents [--check]` | Génère `llms.txt`, `llms-full.txt`, `AGENTS.md`, `CLAUDE.md`, schémas et références. |

> `grafts` a été retiré tant qu'aucune implémentation stable n'est disponible.

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
