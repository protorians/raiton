# Annexe technique — Optimisation de l'écosystème

**Feature**: `specs/002-framework-optimization/spec.md`
**Date**: 2026-11-27
**Statut**: notes d'implémentation, hors périmètre normatif de `spec.md`

Cette annexe traduit les exigences de la spec en points d'appui concrets pour la phase de planification. Elle ne crée aucun engagement de performance : les budgets restent ceux de `001-performance-optimization/metrics.md`.

---

## 1. Quick wins identifiés dans le code actuel

Ces corrections sont indépendantes des gros chantiers et devraient être traitées en premier.

| Constat | Fichier / zone | Correction attendue | Exigence liée |
|---|---|---|---|
| `raiton.config.ts` est documenté, mais le chargeur ne lit que `.json`, `.js` et `.mjs` | `source/core/config/config.ts` | Tenter `.ts` (et `.mts`/`.cts`) dans l'ordre documenté, avec message clair si le runtime ne peut pas l'importer | FR-012 |
| `package.json` déclare `"types": "./source/core/index.d.ts"`, fichier absent | `package.json` | Générer les déclarations au build ou pointer vers une entrée réellement publiée | FR-014, FR-031 |
| `openApiPlugin` exige une fonction `ui` : sans elle, `/docs` ne sert rien | `source/framework/plugins/openapi.plugin.ts` | Fournir une UI par défaut (Scalar ou Redoc) et un endpoint JSON par défaut | FR-020 |
| `artifact` et `grafts` sont des stubs visibles dans `--help` | `source/commands/artifact.command.ts`, `grafts.command.ts` | Implémenter ou masquer explicitement jusqu'à disponibilité | FR-004, FR-008, FR-009 |
| La documentation est uniquement en français et sans index machine | `docs/` | Ajouter une version anglaise, `llms.txt` et un index généré | FR-025, SC-016 |
| Aucun identifiant de corrélation, métriques ni catalogue d'erreurs | `source/core/application.ts`, `source/framework/responses/` | Ajouter le contexte de corrélation, `/metrics`, codes d'erreur stables | FR-026 à FR-028 |
| Aucun outil de création ou de génération | `source/bin/commands.registry.ts` | Ajouter les commandes décrites en section 2 | FR-001 à FR-005 |

---

## 2. Surface CLI cible

Les noms ci-dessous sont indicatifs ; l'exigence normative est le comportement décrit dans `spec.md`.

```bash
# Création
raiton new my-api --template api --runtime bun --yes
raiton new my-api --template mcp-agent --offline

# Génération
raiton generate resource users
raiton generate controller billing
raiton generate service invoices
raiton generate repository users
raiton generate dto create-user
raiton generate mcp-tool refund
raiton generate test users

# Inventaire et diagnostic
raiton routes
raiton routes --json
raiton inspect --json
raiton why GET /api/users/:id
raiton doctor
raiton doctor --json --fix

# Documentation et contrats
raiton openapi export --out openapi.json
raiton client --out ./sdk
raiton contract check --baseline openapi.baseline.json

# MCP
raiton mcp list
raiton mcp inspect math
raiton mcp test math.add --args '{"a":1,"b":2}'
```

Règles transverses :

- `--json` : sortie machine sur `stdout`, logs sur `stderr`, schéma stable et versionné.
- `--dry-run` : obligatoire pour toute commande qui écrit des fichiers.
- `--yes` : aucune invite ; échec explicite si une information manque.
- Codes de sortie : `0` succès, `1` erreur d'usage, `2` prérequis manquant, `3` conflit de fichiers, `4` échec de diagnostic.
- Toute erreur expose `{ code, message, hint, docsUrl, location? }`.

---

## 3. Manifeste de projet

Forme cible, versionnée et validée par un JSON Schema publié :

```json
{
  "schemaVersion": "1.0.0",
  "framework": { "name": "raiton", "version": "6.8.9-beta.25" },
  "runtime": "bun",
  "project": { "rootDir": "source", "entry": "source/main.ts" },
  "routes": [
    {
      "method": "GET",
      "path": "/api/users/:id",
      "version": null,
      "controller": "UsersController",
      "handler": "show",
      "file": "source/controllers/users.controller.ts",
      "line": 42,
      "input": { "params": { "id": "string" } },
      "output": "User"
    }
  ],
  "injection": {
    "UsersService": ["UsersRepository"],
    "UsersRepository": []
  },
  "artifacts": ["controller", "service", "repository", "mcp"],
  "config": { "port": "number", "prefix": "string" },
  "env": ["DATABASE_URL", "JWT_SECRET"],
  "mcp": [
    {
      "server": "math",
      "path": "/mcp",
      "tools": [
        {
          "name": "add",
          "inputSchema": { "type": "object" },
          "annotations": { "readOnlyHint": true, "destructiveHint": false }
        }
      ]
    }
  ]
}
```

Contraintes :

- généré depuis les registres existants (`scope.router`, `Injection`, `Artifacts`, registres socket/MCP/scheduler) ;
- jamais exécuté sur le chemin chaud d'une requête ;
- disponible en CLI et, en développement uniquement, via un endpoint dédié ;
- compatible HMR : un rechargement invalide l'inventaire en cache.

---

## 4. Contrats schema-first

Objectif : une seule source pour la validation, les types, l'OpenAPI et le client.

```ts
import { t } from "raiton/contracts"

export const CreateUser = t.object({
  email: t.string().email(),
  name: t.string().min(2),
  age: t.integer().min(0).optional(),
})

export type CreateUser = t.infer<typeof CreateUser>

@Controllable("/users")
export class UsersController {
  @Post("/")
  @Input(CreateUser)
  @Output(User)
  create(@Body() input: CreateUser) {
    return this.users.create(input)
  }
}
```

Règles :

- TypeBox est déjà une dépendance ; Standard Schema peut être accepté en adaptateur.
- Les erreurs de validation utilisent un format stable :
  ```json
  {
    "error": true,
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [{ "path": "email", "code": "invalid_string", "message": "Invalid email" }]
  }
  ```
- La validation de sortie suit le mode : active en développement/HMR, désactivée par défaut en production.
- Le client généré dérive du manifeste et des schémas ; aucune signature publique ne contient `any`.

---

## 5. MCP

### Transports

- **HTTP** : comportement actuel conservé.
- **stdio** : nouveau transport, même registre d'outils, même suite de conformité.

### Schémas et sûreté

```ts
@McpTool({
  name: "refund",
  description: "Rembourse une commande",
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
})
refund(@McpArg("orderId", "Identifiant de commande", String) orderId: string) {
  return this.payments.refund(orderId)
}
```

- `inputSchema` et `outputSchema` générés depuis les DTO/arguments.
- `structuredContent` lorsque la sortie est un objet.
- Outil destructif non exposé sans option explicite (`exposeDestructive: true`) et scope dédié.
- Audit : identifiant d'appel, outil, durée, résultat, acteur ; secrets expurgés.
- Limite de débit par serveur et par outil.

### Documentation pour agents

Générer depuis le manifeste + le guide :

```text
llms.txt          index compact : concepts, commandes, liens
llms-full.txt     référence complète concaténée
AGENTS.md         conventions, commandes déterministes, pièges connus
CLAUDE.md         variante si nécessaire, même contenu
```

Une commande dédiée doit produire ces fichiers sans édition manuelle et échouer si un export public n'a pas de recette.

---

## 6. Observabilité

Variables d'environnement indicatives :

```bash
RAITON_OBSERVABILITY=off|metrics|traces|all
RAITON_METRICS_PATH=/metrics
RAITON_OTEL_ENDPOINT=http://localhost:4318
RAITON_REQUEST_ID_HEADER=x-request-id
RAITON_SHUTDOWN_TIMEOUT_MS=10000
```

Comportement :

- `off` par défaut : aucun coût sur le chemin chaud, aucune dépendance lourde chargée.
- Identifiant de corrélation : repris de l'en-tête entrant s'il est valide, sinon généré ; injecté dans le contexte, les logs et la réponse.
- Erreurs : catalogue `code` → statut, message public, `docsUrl` ; en production, pas de pile ni de détail interne.
- Arrêt : readiness à `false` immédiatement, arrêt de l'acceptation de nouvelles connexions, drainage borné, sortie `0`.

---

## 7. Page de développement

Montée uniquement lorsque le mode développement est actif.

Contenu minimal :

- routes et fichier source ;
- graphe d'injection ;
- artifacts chargés et événements HMR récents ;
- état health-check et scheduler ;
- liens vers la documentation API et le playground MCP ;
- bouton « copier le manifeste ».

Sécurité : aucune donnée d'environnement sensible, aucune route de production, désactivation explicite possible.

---

## 8. Documentation et recettes

Structure cible :

```text
docs/
├── user-guide/
│   ├── fr/                 contenu actuel
│   ├── en/                 traduction de référence
│   └── recipes/            un fichier exécutable par fonctionnalité
├── generated/
│   ├── api/                référence générée depuis TSDoc + OpenAPI
│   ├── cli/                référence générée depuis les commandes
│   └── manifest-schema.json
├── llms.txt
├── llms-full.txt
└── AGENTS.md
```

Chaque recette doit contenir : objectif, fichier complet, commande d'exécution, sortie attendue. Une recette qui ne s'exécute pas en CI est considérée comme cassée.

---

## 9. Mesure et non-régression

Le harnais et les budgets de `001-performance-optimization/metrics.md` font foi. Scénarios à ajouter pour la 002 :

| Scénario | Budget proposé | Statut |
|---|---|---|
| Observabilité désactivée | 0 surcoût p50 mesurable | à valider |
| Observabilité `metrics` activée | ≤ 5 % de surcoût p50 | à valider |
| Observabilité `traces` activée | ≤ 10 % de surcoût p50 | à valider |
| Génération de manifeste | hors chemin chaud, CLI/dev uniquement | revue d'architecture |
| Validation schema-first | ≤ coût de la validation actuelle à champs équivalents | à mesurer |
| Client généré | 0 impact runtime | par construction |
| Page de développement | 0 impact en production (non montée) | test de démarrage |
| Création de projet | ≤ 60 s hors installation réseau | à mesurer |

Règles :

- toute fonctionnalité opt-in doit être mesurée dans les deux états ;
- les benchmarks 002 sont ajoutés à la commande de benchmark unique ;
- la CI échoue si un budget 001 ou 002 est dépassé ;
- les résultats sont archivés au format Markdown et JSON, comparables au tag précédent.

---

## 10. Risques et dépendances

| Risque | Impact | Mitigation |
|---|---|---|
| Élargissement du périmètre au-delà d'une spec planifiable | Retard, implémentation partielle | Découper en lots : onboarding, contrats, IA, observabilité |
| Dépendances lourdes chargées par défaut | Régression du démarrage (spec 001) | Imports paresseux, fonctionnalités opt-in, budgets CI |
| Divergence entre schéma runtime et OpenAPI | Contrats faux, clients cassés | Source unique + tests de cohérence |
| Outils MCP destructifs exposés par erreur | Incident de production | Default-deny, scopes, audit |
| Documentation générée qui dérive | Perte de confiance | Génération en CI + vérification de fraîcheur |
| Parité Node/Deno incomplète | Promesse multi-runtime affaiblie | Suite de conformité par runtime, chemins dégradés explicites |

Dépendances :

- spec 001 pour les budgets et le harnais ;
- future spec auth pour les scopes MCP et les politiques d'accès ;
- future spec data pour les générateurs de dépôt et de migration ;
- publication npm et CI existantes.

---

## 11. Historique

| Date | Version | Changement |
|---|---|---|
| 2026-11-27 | 1.0 | Création de l'annexe technique de la spec 002 |
