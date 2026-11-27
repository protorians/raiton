# Debug runtime assisté par IA

> **Navigation :** [← observability](observability.md) | [best-practices →](best-practices.md)

Raiton expose un jeu de surfaces de debug destinées aux développeurs et aux
agents IA : invoquer une route sans deviner son contrat, retrouver une requête
par son identifiant, expliquer un échec et vérifier les contrats de bout en
bout. Toutes les surfaces sont **opt-in** et désactivées par défaut en
production.

## Activation

Les surfaces sont actives en développement (`develop`, HMR ou
`NODE_ENV=development`). En production, une activation explicite est requise :

```ts
// raiton.config.ts
export default {
  debug: {
    enabled: true,
    journal: {enabled: true, capture: "full", capacity: 1_000},
    http: {enabled: true, basePath: "/__raiton", loopbackOnly: true},
    mcp: {enabled: true, path: "/__raiton/mcp"},
    replay: {allowUnsafeMethods: false},
  },
}
```

Variables d'environnement : `RAITON_DEBUG`, `RAITON_DEBUG_JOURNAL`,
`RAITON_DEBUG_MCP` et `RAITON_DEBUG_TOKEN`.

## Invoquer une route

```bash
raiton call GET /api/items/:id --param id=42 --json
raiton call POST /api/items --data '{"name":"Raiton"}' --json
raiton call POST /api/items --data @payload.json --url http://localhost:5711
raiton call POST /api/items --example create --dry-run
```

- la route est résolue depuis le manifeste (préfixe, paramètres, query, en-têtes) ;
- l'entrée est validée **avant** l'envoi : un corps invalide n'exécute jamais le handler ;
- le résultat contient la requête résolue, le statut, le corps, la durée, les identifiants de corrélation et de trace ;
- une violation du contrat de sortie est signalée avec la route et le champ ;
- `--json` écrit un document unique sur `stdout` ; les journaux restent sur `stderr`.

Codes de sortie : `0` réponse reçue, `1` usage invalide, `2` prérequis ou
connexion impossible, `4` validation, contrat de sortie ou `--fail-on`.

## Journal, explication et rejeu

```bash
raiton requests --since 5m --status 4xx --limit 20
raiton explain <requestId>
raiton explain --last --json
raiton call --replay <requestId> --force
```

Le journal est un ring buffer borné (1 000 entrées et 8 Mio par défaut,
expiration après 15 minutes). Les corps, en-têtes, query et paramètres sont
expurgés puis tronqués à `maxBodyBytes` (64 Kio par défaut).

L'explication contient la route, le fichier et la ligne source, le handler, la
chronologie (middleware, validation, cache, handler), la cause racine, les
valeurs attendues/reçues et les actions suivantes. Le rejeu des méthodes
non idempotentes exige `--force` (ou `debug.replay.allowUnsafeMethods`).

Le journal est en mémoire dans le processus applicatif. Pour enchaîner deux
commandes CLI courtes, Raiton conserve un journal de session borné dans
`.raiton/debug-session.json` ; `raiton requests` et `raiton explain` ciblent
d'abord une application en cours d'exécution (`--url`), puis ce journal.

## Serveur MCP de debug

```bash
raiton mcp debug --stdio
raiton mcp debug --http --port 5711 --token "$RAITON_DEBUG_TOKEN"
```

En mode application, le transport HTTP est monté sur `/__raiton/mcp` lorsque
`debug.mcp.enabled` est vrai. Les outils exposés sont :

| Outil | Sûreté | Rôle |
|---|---|---|
| `routes.list` | lecture seule | Routes du manifeste |
| `routes.get` | lecture seule | Schémas, exemples et source d'une route |
| `routes.call` | non destructif | Appel avec validation et contrat de sortie |
| `requests.recent` | lecture seule | Entrées récentes sans corps |
| `requests.get` | lecture seule | Détail d'une entrée |
| `requests.explain` | lecture seule | Chronologie, cause et actions |
| `requests.replay` | destructif, masqué par défaut | Rejeu explicite |
| `doctor.run` | lecture seule | Diagnostic du projet |
| `manifest.get` | lecture seule | Manifeste versionné |
| `logs.tail` | lecture seule | Dernières lignes expurgées |

Le serveur passe la suite de conformité HTTP et stdio existante
(`raiton mcp conformance`). Les scopes sont `debug:read`, `debug:call`,
`debug:replay` et `debug:admin` ; les appels sont audités par l'infrastructure MCP.

## Vérifier les contrats

```bash
raiton verify --json
raiton verify --route /api/items --fail-on 4xx,5xx
raiton verify --from openapi --json
```

Chaque route est appelée avec son exemple (déclaré avec `@Example()` ou généré
depuis le schéma), le statut et le contrat de sortie sont validés, puis un
rapport par route est produit. Les méthodes non idempotentes sont ignorées par
défaut et listées dans `skipped` ; `--allow-unsafe` les exécute explicitement.
Un échec retourne le code `4` et un JSON valide.

## Sécurité

- surfaces désactivées par défaut en production (`debug.enabled=false`) ;
- liaison locale par défaut (`loopbackOnly`) et jeton requis hors loopback ;
- comparaison de jeton en temps constant, en-tête `x-raiton-debug-token` ou `Authorization: Bearer` ;
- expurgation récursive des en-têtes et champs sensibles, extensible via `debug.journal.redact` ;
- aucune pile ni emplacement interne dans les erreurs de production ;
- rejeu non idempotent refusé sans confirmation explicite ;
- corps et pile tronqués avant stockage ; le journal n'attend jamais et n'échoue jamais une requête.

## Erreurs enrichies

En développement, une erreur contient le code stable, le statut, le message, le
lien de documentation, l'identifiant de corrélation, une action corrective
(`hint`), et dans `details` le chemin, le code, la valeur attendue, la valeur
reçue et l'emplacement du contrat. En production, seuls le code, le statut, le
message, la documentation, le `hint` et la corrélation sont exposés.
