# CLI et workflow

> **Navigation :** [← plugins](plugins.md) | [best-practices →](best-practices.md)

Le CLI couvre le cycle standard de développement d’une application Raiton.

## Pourquoi utilisé

- lancer rapidement un serveur en local
- vérifier le comportement pendant l’implémentation
- produire une version compilée pour la livraison ou le déploiement

Raiton fonctionne sur les trois runtimes majeurs : **Bun**, **Node.js** et **Deno**.

```bash
# Bun — exécution TypeScript native (aucune compilation requise)
bun raiton dev
bun raiton build
bun raiton start

# Node.js — le CLI est fourni sous forme de bundle JS (build/bin/index.mjs)
node build/bin/index.mjs dev
node build/bin/index.mjs start

# Deno — exécution TypeScript native, tâches déclarées dans deno.json
deno task dev
deno task build
deno task start
deno task compile   # génère un binaire autonome (build/bin/raiton)
```

## Commandes principales

- `dev` lance le projet avec hot reloading (HMR)
- `build` génère un artefact exécutable
- `start` démarre l’application compilée (sans HMR)

## Commandes utiles

```bash
bun raiton --help
bun raiton --version
```

Quand vous faites évoluer l’application, gardez l’ordre suivant :
- modifier le code
- lancer `bun raiton dev`
- vérifier le comportement
- lancer `bun raiton build` avant livraison

## Mode dev vs mode prod

Le mode dev utilise le système de HMR embarqué : le builder observe le
répertoire source et recompile les artefacts (contrôleurs, services,
middlewares, sockets, hooks, MCP) sans redémarrer le processus.

Le mode `start` démarre l’application sans HMR :
- sur **Bun** et **Deno**, le bootstrapper TypeScript est importé directement
- sur **Node.js**, l’application est compilée (esbuild) vers `.raiton/server/main.mjs`
  puis exécutée

## Runtimes

| Runtime | Exécution TS native | Dev (HMR) | Prod (bundle) |
| --- | --- | --- | --- |
| Bun | Oui | `bun raiton dev` | `bun raiton start` |
| Node.js | Non (bundle JS requis) | `node build/bin/index.mjs dev` | `node build/bin/index.mjs start` |
| Deno | Oui | `deno task dev` | `deno task start` / `deno task compile` |

## Avantages

- flux simple et prévisible
- adapté au développement quotidien
- garde la différence claire entre exécution locale et artefact compilé

## Inconvénients

- demande de bien distinguer `dev` et `start`
- le build ajoute une étape supplémentaire avant livraison

---

[← plugins](plugins.md) | [best-practices →](best-practices.md)