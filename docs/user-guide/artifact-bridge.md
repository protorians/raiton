# Artifact Bridge

Le bridge d'artefacts permet de monter du code que le scan par suffixe ne peut
pas découvrir : artefacts fournis par des packages npm, fichiers locaux hors
convention, middleware et hooks applicatifs.

> Le bridge est **optionnel**. Sans `artifacts.bridge.ts`, le comportement de
> l'application est strictement identique au scan par suffixe.

## Fichier

Par défaut, Raiton découvre `artifacts.bridge.ts` dans le `rootDir` du projet
(`source/` par défaut).

```ts
// source/artifacts.bridge.ts
import {defineArtifactBridge} from "raiton/core";

import {UsersController} from "@acme/users";
import {AuthMiddleware} from "@acme/auth";
import {auditHook} from "./hooks/audit.ts";
import {LegacyController} from "./legacy/handlers.ts";

export default defineArtifactBridge({
    artifacts: [
        // Classes déjà importées (forme recommandée)
        UsersController,

        // Modules : tous les exports décorés sont inspectés
        "@acme/analytics",
        "@acme/legacy/dist/index.js",

        // Fichier local hors convention
        "./legacy/handlers.ts",

        // Middleware applicatif
        {middleware: AuthMiddleware, name: "acme-auth"},

        // Hook applicatif
        {hook: "onRequest", handler: auditHook, name: "acme-audit"},
    ],
});
```

Le bridge ne remplace pas `main.ts` : le bootstrap, la configuration et les
plugins restent dans `main.ts`.

## Configuration

```ts
// raiton.config.ts
export default {
    rootDir: "./source",
    artifacts: {
        // Chemin explicite, relatif au workdir ou au rootDir.
        // `false` désactive complètement le bridge.
        bridge: "./artifacts.bridge.ts",
        // Découverte des dépendances directes auto-descriptives (défaut : true).
        packages: true,
        // Restriction optionnelle à certains packages.
        packageAllowlist: ["@acme/users"],
    },
};
```

## Types d'entrées

| Entrée | Résultat |
|---|---|
| `UsersController` | Classification par métadonnées de décorateurs |
| `"@acme/users"` | Import du module, inspection de tous les exports nommés et `default` |
| `"./legacy/handlers.ts"` | Fichier local hors convention |
| `{middleware, name?, order?}` | Middleware global, après les middleware intégrés |
| `{hook, handler, name?}` | Hook global (`onRequest`, `preParsing`, `preHandler`, `onSend`, `onResponse`) |
| `{plugin}` | Délégation à `application.register(plugin)` |

Une fonction sans métadonnée et sans descripteur est ambiguë : elle est rejetée
avec `BRIDGE_ARTIFACT_AMBIGUOUS`.

## Packages auto-descriptifs

Une dépendance **directe** peut déclarer ses artefacts :

```json
{
  "name": "@acme/users",
  "peerDependencies": {"raiton": "^6"},
  "raiton": {
    "artifacts": [
      "./dist/users.controller.js",
      "./dist/users.service.js"
    ]
  }
}
```

Ou exposer un module bridge :

```json
{
  "raiton": {
    "artifacts": "./dist/artifacts.bridge.js"
  }
}
```

Contrat de package :

- déclarer `raiton` en `peerDependency`, jamais l'embarquer ;
- ne pas livrer une copie imbriquée de Raiton ;
- livrer du JavaScript exécutable par le runtime cible ;
- importer `reflect-metadata` une seule fois au niveau de l'application.

Les dépendances transitives ne sont pas découvertes. Il n'y a aucun scan
récursif de `node_modules`.

## CLI

```bash
raiton artifact --dump --json   # origine scan/bridge, type, package, fichier
raiton inspect --json           # section `bridge` du manifeste
raiton why GET /users           # origine de la route
raiton doctor                   # diagnostics du bridge
```

`build`, `dev` et `start` chargent le bridge automatiquement. Sur Node.js, le
bridge est compilé dans `.raiton/server/artifacts.bridge.mjs` ; `raiton build`
doit être exécuté avant `raiton start`.

## Rechargement à chaud

- Bun et Deno : le fichier bridge est surveillé ; ajouts, retraits et
  modifications sont réconciliés sans redémarrage complet.
- Node.js : le redémarrage contrôlé existant est utilisé.
- Les modules de packages externes ne sont pas surveillés : redémarrez après
  leur mise à jour.

Le rechargement ne retire que les artefacts possédés par le bridge. Les routes,
instances, middleware et hooks découverts par le scan local restent intacts.

## Diagnostics

Tous les codes sont stables et pointent vers ce guide :

| Code | Cause |
|---|---|
| `BRIDGE_FILE_NOT_FOUND` | Chemin configuré introuvable |
| `BRIDGE_FILE_INVALID_EXPORT` | Export par défaut absent ou invalide |
| `BRIDGE_IMPORT_FAILED` | Exception à l'import |
| `BRIDGE_MODULE_NOT_FOUND` | Spécificateur non résolvable |
| `BRIDGE_ENTRY_INVALID` | Entrée non supportée |
| `BRIDGE_ARTIFACT_NOT_FOUND` | Module sans artefact décoré |
| `BRIDGE_ARTIFACT_AMBIGUOUS` | Fonction sans métadonnée ni descripteur |
| `BRIDGE_NAME_COLLISION` | Deux classes partagent le même nom DI |
| `BRIDGE_ABI_MISMATCH` | Copie de Raiton incompatible dans un package |
| `BRIDGE_RUNTIME_UNSUPPORTED` | Entrée TypeScript sur un runtime qui ne la lit pas |
| `BRIDGE_NOT_BUNDLED` | Bridge non compilé pour Node.js |
| `BRIDGE_PACKAGE_FIELD_INVALID` | `package.json#raiton.artifacts` invalide |
| `BRIDGE_HOOK_UNKNOWN` | Hook non supporté |

Les codes `BRIDGE_ARTIFACT_DUPLICATE` et `BRIDGE_DUPLICATE_MOUNT` sont
informatifs : le premier artefact rencontré est conservé.

## Performance

Le bridge absent ne coûte que quelques vérifications d'existence. Les entrées
constituent une allowlist explicite ; aucun glob non borné ni scan récursif de
`node_modules` n'est exécuté. Le chargement d'un bridge de 50 entrées doit rester
sous le budget de démarrage documenté par la spec 001, hors import des modules
externes.
