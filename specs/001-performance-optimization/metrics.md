# Annexes métriques — Optimisation des performances Raiton

**Feature**: `specs/001-performance-optimization/spec.md`
**Spec liée**: `specs/002-framework-optimization/spec.md`
**Date des mesures**: 2026-11-26
**Révision**: 2026-11-27 — aucune nouvelle mesure ; ajout des garde-fous de mesure applicables à la spec 002.
**Statut**: mesures de référence (baseline) + projections

Ce document est l'annexe technique de la spécification. Il documente :

1. l'environnement et la méthodologie ;
2. les mesures de référence du code actuel ;
3. les gains mesurés sur prototypes ;
4. les projections par scénario ;
5. les hypothèses d'implémentation et les garde-fous HMR.

Les chiffres sont des **médianes** ou des mesures répétées, arrondies. Les projections sont explicitement marquées **Estimé** ; les mesures sur prototypes sont marquées **Mesuré**.

---

## 1. Environnement de mesure

| Élément | Valeur |
|---|---|
| Machine | Apple Silicon (darwin) |
| Runtime principal | Bun 1.4.2 |
| Runtime secondaire | Node 22.20.0 |
| Processus | unique, sans réseau |
| Cache | système de fichiers chaud |
| Itérations | 2 000 à 20 000 selon scénario, après warm-up |
| Statistique | médiane sur exécutions répétées |
| Périmètre | hors réseau, hors sérialisation JSON sauf mention |

**Limites** : les micro-benchmarks mesurent le coût CPU du framework, pas la latence réseau. La variance observée entre deux campagnes peut atteindre ±10 à ±20 %. Les chiffres de bout en bout utilisent un `reply` factice synchrone, ce qui isole le coût du framework.

---

## 2. Baseline mesurée du code actuel

### 2.1 Routage — sensibilité à l'ordre d'enregistrement

`RouteMatcher.match()` parcourt linéairement toutes les routes et `Route.match()` recompile une `RegExp` à chaque appel. Le coût dépend donc de la position de la route cible.

Scénario : 300 routes paramétriques, requête `GET /health`.

| Position de la route cible | Code actuel | Prototype trie | Gain |
|---|---:|---:|---:|
| Première | 0,375 µs | 0,160 µs | ~2,3× |
| Milieu | 67,647 µs | 0,129 µs | ~524× |
| Dernière | **134,325 µs** | **0,118 µs** | **~1 138×** |

Routes paramétriques et profondes, cible en dernière position, 300 routes :

| Scénario | Code actuel | Prototype trie | Gain |
|---|---:|---:|---:|
| `/res150/42` | 136,617 µs | 0,185 µs | ~738× |
| `/res299/42/sub/x` | 149,682 µs | 0,238 µs | ~629× |

**Lecture** : le problème n'est pas seulement le nombre de routes, c'est la **prévisibilité**. Une route enregistrée tôt est rapide, une route enregistrée tard est très lente. La cible de la spec est de rendre le coût indépendant de la position.

### 2.2 Pile HTTP complète (`Application.handle`)

Scénario : `GET /health`, handler trivial retournant `{ ok: true }`, `reply` factice, 0 à 300 routes supplémentaires.

| Routes supplémentaires | Cible en premier | Cible en dernier | Débit cible en dernier |
|---:|---:|---:|---:|
| 0 | 4,94 µs* | 2,34 µs | ~427 000 req/s |
| 50 | 2,70 µs | 23,11 µs | ~43 000 req/s |
| 100 | 2,46 µs | 48,44 µs | ~20 600 req/s |
| 300 | **2,13 µs** | **131,37 µs** | **~7 600 req/s** |

\* mesure ponctuelle bruitée ; le plancher observé est ~2,1–2,5 µs.

**Lecture** : avec 300 routes et une cible en dernier, le routage représente ~129 µs sur 131 µs, soit **98 % du coût framework**. Le handler et les middlewares sont négligeables dans ce scénario.

### 2.3 Middlewares

Scénario : `n` middlewares `async` appelant `next()`, terminal trivial.

| Middlewares | Composition par requête | Chaîne précomposée | `MiddlewarePipeline.run` |
|---:|---:|---:|---:|
| 0 | 0,550 µs | 0,280 µs | 0,408 µs |
| 3 | 1,227 µs | 1,150 µs | 1,127 µs |
| 6 | 1,997 µs | 1,940 µs | 1,912 µs |
| 10 | 2,912 µs | 2,901 µs | 3,081 µs |

**Lecture** : la précomposition apporte **~3 %** au mieux. Le coût dominant est la chaîne de promesses, pas la composition. La précomposition reste utile pour réduire les allocations et la pression GC, mais **ne doit pas être vendue comme un gain majeur**. Elle est classée micro-optimisation.

### 2.4 Validation, réflexion et en-têtes

| Opération | Coût mesuré |
|---|---:|
| `class-validator.validate()` — DTO minimal | 6,65 µs |
| `validate()` — DTO de 8 champs décorés | **18,47 µs** |
| Construction + `validate()` — 8 champs | 14,32 µs |
| `Reflect.getMetadata()` — hit ou miss | 0,25–0,27 µs |
| `new Headers()` + 3 `get()` | **1,27 µs** |
| Body parser supplémentaire installé (GET) | +0,13 µs |
| `new TextDecoder()` vs instance partagée | 0,74 vs 0,64 µs (+0,10 µs) |
| Lecture corps 547 octets — lecteur manuel | **12,31 µs** |
| Lecture corps 547 octets — `Response.arrayBuffer()` | **1,92 µs** |

**Lecture** :
- La validation de réponse coûte plus cher que tout le routage best-case. En production, elle doit être désactivée par défaut.
- La réflexion isolée est bon marché, mais elle est appelée plusieurs fois par requête ; la sortir du chemin chaud est une optimisation propre, pas un gain massif.
- Sur Node, `NodeRequest.headers` crée un `Headers` à chaque accès ; un cache par requête supprime 1 à 3 allocations de 1,3 µs.
- Le body parser gagne surtout sur la lecture du corps (~10 µs pour 547 octets, ~6,4×). Le gain du dédoublonnage est faible en GET (~0,13 µs), mais le doublon reste une anomalie à corriger.

### 2.5 Démarrage et développement

| Mesure | Valeur |
|---|---:|
| Import `framework/index.ts` (processus neuf) | **133–139 ms** |
| Import `core/index.ts` | 137–142 ms |
| Import `framework/decorators/index.ts` | 130–132 ms |
| Import `framework/encryption.ts` | 21–22 ms |
| Import `framework/plugins/body-parser.plugin.ts` | 15 ms |
| Runtime nu (`bun -e`) | ~11 ms |
| Classification de 5 000 fichiers (`Artifacts.classify`) | **10,7 ms** (2,1 µs/fichier) |
| Classification par lookup `Map` (prototype) | 1,2 ms |
| Reload HMR contrôleur 3 routes — p50 | **0,6 ms** |
| Reload HMR contrôleur 3 routes — p90 | 1,1 ms |
| Routes après 30 reloads | 3 (stable, aucun doublon) |

**Lecture** :
- Le HMR est déjà rapide (~0,6 ms). L'objectif est de **ne pas le dégrader**, pas de le réécrire.
- Le gain dev vient surtout du chemin chaud par requête (mêmes optimisations qu'en prod) et d'un démarrage plus léger.
- La classification des artefacts est un coût de boot réel mais secondaire (~10 ms pour 5 000 fichiers) ; elle doit être optimisée sans être prioritaire.

---

## 3. Matrice des optimisations

| # | Optimisation | Fichiers principaux | Gain mesuré / estimé | Confiance | Impact HMR |
|---|---|---|---|---|---|
| 1 | Index de routes (statique O(1), trie paramétrique) + motifs précompilés | `source/core/router/matcher.ts`, `route.ts` | Jusqu'à **~1 100×** sur le matching ; **~50×** sur la pile HTTP worst-case | Mesuré (prototype) | Aucun si `remove/add` complets |
| 2 | Paramètres de route non partagés (objet par requête) | `route.ts`, `application.ts` | Supprime une course de données ; coût ~0 | Mesuré (raisonnement) | Aucun |
| 3 | Métadonnées de handler précompilées | `router/handler.ts`, `handler.utils.ts` | **~0,5–1 µs** de réflexion + suppressions d'allocations | Mesuré (réflexion) | Aucun : handlers recréés au recompile |
| 4 | Validation de réponse désactivée en production | `handler.utils.ts`, config | **~18,5 µs** par réponse validée | Mesuré | Aucun ; validation conservée en dev |
| 5 | Cache des en-têtes Node | `runtime/node/request.ts` | **~1,3 µs** par accès supprimé | Mesuré | Aucun |
| 6 | Body parser : lecture native + TextDecoder partagé + URL unique | `plugins/body-parser.plugin.ts` | **~10 µs** par corps de 547 o ; ~0,1 µs TextDecoder | Mesuré | Aucun |
| 7 | Body parser installé une seule fois | `application.ts`, `thread.ts` ou `plugins/scope.ts` | ~0,13 µs en GET ; évite un double traitement des corps | Mesuré | Aucun |
| 8 | Pipeline précomposé | `middleware/pipeline.ts` | **~3 %** CPU ; réduit les allocations | Mesuré | **Invalidation requise** |
| 9 | Caches de hooks invalidables | `core/hooks.ts` | Faible ; évite les `await` vides | Estimé | **Invalidation requise** |
| 10 | Invalidation du cache de routes au recompile | `framework/cache/*`, `controller/builder.ts` | Correctness HMR | Mesuré (concept) | **Requis** |
| 11 | Mémoïsation DI par constructeur | `core/injection/injection.ts` | Démarrage/sockets ; faible en HTTP | Estimé | **Clé = constructeur** |
| 12 | Imports paresseux (argon2, bcrypt, class-validator, esbuild) | `encryption.ts`, `builder.ts`, barrels | **~10 ms** sur encryption ; davantage sur bundle | Mesuré (import) | Aucun |
| 13 | Sous-chemins d'export / réduction des barrels | `framework/index.ts`, `core/index.ts`, `package.json` | **~130 ms → ≤ 30 ms** pour `decorators` (cible) | Estimé | Aucun |
| 14 | Classification d'artefacts par lookup | `framework/artifacts.ts` | **10,7 ms → 1,2 ms** pour 5 000 fichiers | Mesuré (prototype) | Aucun |
| 15 | Scan : un seul `readdir`, une seule classification par fichier | `controller/builder.ts`, `builder.ts` | Quelques ms au boot | Estimé | Aucun (conserver `?v&t`) |

---

## 4. Projections par scénario

Les projections combinent les mesures ci-dessus. Elles servent de budgets à la CI et seront remplacées par des mesures bout-en-bout après implémentation.

### Scénario A — Production, 300 routes, cible en dernier (worst-case)

| Métrique | Baseline | Cible | Gain |
|---|---:|---:|---:|
| Coût framework / requête | 131,37 µs | **≤ 5 µs** | **≥ 26×** |
| Débit single-core (harnais) | ~7 600 req/s | **≥ 250 000 req/s** | **≥ 33×** |
| Part du routage | ~129 µs | ≤ 1 µs | ~130× |

Confiance : élevée (prototype trie mesuré à 0,12–0,24 µs + plancher applicatif ~2,3 µs).

### Scénario B — Production, 300 routes, cible en premier (best-case)

| Métrique | Baseline | Cible | Gain |
|---|---:|---:|---:|
| Coût framework / requête | 2,13 µs | ~2,3 µs | 0 (non-régression) |
| Débit single-core | ~469 000 req/s | ≥ 400 000 req/s | 0 |

Confiance : élevée. Le best-case est déjà bon ; l'objectif est de ne pas le dégrader et de supprimer la dépendance à l'ordre.

### Scénario C — Production, réponse validée `@ApiResponse({ type })`

| Métrique | Baseline | Cible | Gain |
|---|---:|---:|---:|
| Coût / requête | ~20,6 µs (2,13 + 18,47) | ~2,3 µs | **~9×** |
| Débit single-core | ~48 500 req/s | ≥ 400 000 req/s | ~8× |

Confiance : élevée. La validation de réponse est le poste le plus coûteux après le routage.

### Scénario D — Production, `POST` JSON 547 octets

| Métrique | Baseline | Cible | Gain |
|---|---:|---:|---:|
| Lecture du corps | 12,31 µs | 1,92 µs | **~6,4×** |
| Coût framework estimé / requête | ~14,8 µs | ~4,4 µs | ~3,4× |

Confiance : moyenne (mesure de lecture isolée + plancher applicatif).

### Scénario E — Développement et HMR

| Métrique | Baseline | Cible | Gain |
|---|---:|---:|---:|
| Reload contrôleur 3 routes p50 | 0,6 ms | **≤ 2 ms** | Non-régression |
| Reload p90 | 1,1 ms | ≤ 4 ms | Non-régression |
| Doublons après 30 reloads | 0 | **0** | Maintien |
| Coût par requête | Identique prod | Identique prod | Mêmes gains que A/C/D |

Confiance : élevée sur le reload (mesuré) ; les gains par requête dépendent de l'intégration du routeur.

### Scénario F — Démarrage à froid

| Métrique | Baseline | Cible | Gain |
|---|---:|---:|---:|
| Import entrée `framework` | ~135 ms | **≤ 60 ms** | ≥ 2,25× |
| Import sous-chemin `decorators` | ~130 ms | **≤ 30 ms** | ≥ 4,3× |
| Classification 5 000 fichiers | 10,7 ms | ≤ 5,3 ms | ≥ 2× |

Confiance : moyenne à élevée. Les cibles d'import dépendent du découpage effectif des barrels et du chargement paresseux.

---

## 5. Hypothèses d'implémentation

Ces hypothèses ne font pas partie du contrat fonctionnel ; elles guident le plan technique.

1. **Routeur** : index statique `method + path`, trie ou buckets par segment pour les routes paramétriques, motifs compilés à l'ajout. `match()` retourne `{ route, params }` sans muter l'objet `Route`.
2. **Métadonnées** : `createHandler()` capture les paramètres, middlewares de route, validateur de réponse et options de cache. Aucun `Reflect.getMetadata` dans le chemin chaud.
3. **Validation** : option de configuration `validation.responses` avec valeur par défaut `production: false`, `development: true`. Ne pas utiliser `builder.options.serve` (vrai aussi en production) mais `hmr`/`NODE_ENV`.
4. **Node** : `NodeRequest.headers` memoïse un `Headers` par instance ; `ip` réutilise ce cache.
5. **Body parser** : installation idempotente par nom de plugin ; `URL` parsée une fois ; `Response.arrayBuffer()` ou helper natif ; `TextDecoder` partagé ; pas de `URLSearchParams` si `?` absent.
6. **HMR** : `MiddlewarePipeline.invalidate()`, invalidation des hooks, invalidation du cache de route ; conservation stricte du reimport `?v=…&t=…`.
7. **DI** : mémoïsation par `WeakMap` de constructeur ; `normalizeName` mémoïsé par chaîne ; pile de résolution en `Set`.
8. **Léger** : imports dynamiques pour argon2/bcrypt/class-validator/esbuild ; sous-chemins d'export ; `sideEffects: false` après audit ; build ESM publié.

---

## 6. Garde-fous HMR

| Élément rechargé | Mécanisme actuel | Risque introduit | Garde-fou |
|---|---|---|---|
| Contrôleur | `recompile()` → `removeRoutes` + `compileController` | Index de routes obsolète | `remove()` exhaustif sur tous les index ; test de stabilité sur 30 reloads |
| Middleware | `Artifacts.reloadMiddleware` → `replace()` | Chaîne précomposée obsolète | `invalidate()` dans `use/replace/remove/clear` |
| Hook | `Artifacts.reloadHook` → `replace()` | Cache de hooks obsolète | Invalidation ou pas de cache |
| DI | `updateConstruct` + `invalidateCascade` | Résolution d'une ancienne classe | Mémoïsation par constructeur, jamais par nom |
| Cache de route | Aucune invalidation aujourd'hui | Réponse `@Cache` périmée | Invalidation par route au recompile |
| Socket / MCP / Scheduler | `build` / `reload*` | Double enregistrement | Tests de non-duplication |

**Couplage à surveiller** : `Artifacts.isRegistered()` inspecte `registry.stack` (middlewares) et `hooks instanceof Map`. Toute refonte de ces structures doit mettre à jour cette fonction, sinon le HMR remplacera silencieusement dans le vide.

**Limite HMR existante à documenter** : le suivi des routes est indexé par nom de classe (`ControllerRouteTracker`). Renommer une classe de contrôleur peut laisser les anciennes routes actives. Ce n'est pas introduit par l'optimisation, mais le plan doit soit le corriger, soit le documenter.

---

## 7. Protocole de reproduction

Les benchmarks de référence ont été exécutés dans un processus Bun unique, avec un `Application` réel et un `reply` factice. Pour reproduire :

1. **Routage** : enregistrer `N` routes `/res{i}/:id` (et une variante profonde `/res{i}/:id/sub/:sub`), puis la route cible `/health` en première, au milieu ou en dernière position. Mesurer `router.match("GET", "/health")` après 2 000 warm-up, sur 20 000 itérations.
2. **Pile HTTP** : créer une `Application`, enregistrer `/health` puis `N` routes, appeler `await app.handle(req, reply)` avec un `req` mocké (`method`, `url`, `headers`, `body`) et un `reply` mocké (`status`, `header`, `send`, `text`, `json`, `type`).
3. **Middlewares** : comparer `middlewareCompose([...mws, terminal])(ctx)` par requête et une chaîne précomposée, avec 0/3/6/10 middlewares.
4. **Validation** : mesurer `validate()` sur un DTO de 8 champs décorés (`@IsString`, `@IsEmail`, `@IsInt`, `@Min`, `@Max`, `@IsBoolean`, `@Length`).
5. **Démarrage** : lancer chaque import dans un processus neuf (`bun -e`), trois fois, prendre la médiane, soustraire le runtime nu (~11 ms).
6. **HMR** : recompiler 30 fois un contrôleur à 3 routes avec un paramètre `?t=` neuf, mesurer import + `ControllerBuilder.recompile`, puis vérifier `router.getRoutes().length === 3`.
7. **Classification** : appeler `Artifacts.classify()` sur 5 000 chemins `.service.ts` et comparer à un lookup `Map` par suffixe.

**À publier avec l'implémentation** : une commande `bun run bench` et un rapport Markdown/JSON versionné, avec comparaison au tag précédent.

---

## 8. Décisions et alternatives écartées

| Décision | Justification | Alternative écartée |
|---|---|---|
| Index + trie pour le routage | Coût prévisible, O(segments), compatible HMR | Garder la boucle O(n) et « trier les routes » : ne règle pas les routes paramétriques ni la recompilation de regex |
| Validation de réponse off en prod | 18,5 µs pour une valeur nulle en production | Garder la validation partout : coût supérieur au routage |
| Précomposition des middlewares | Réduit les allocations, gain CPU ~3 % | La présenter comme gain majeur : non mesuré |
| Imports paresseux plutôt que suppression de dépendances | Préserve les fonctionnalités optionnelles | Supprimer argon2/bcrypt/class-validator : breaking change |
| Mesures bout-en-bout avec reply factice | Isole le framework du réseau et de la sérialisation | Benchmark réseau seul : ne montre pas le coût interne |

---

## 9. Garde-fous de mesure pour la spec 002

La spec `002-framework-optimization` ajoute des fonctionnalités d'adoption, de contrats, d'IA et d'observabilité. Aucune ne doit dégrader les budgets ci-dessus. Les scénarios suivants doivent être ajoutés au harnais unique et mesurés dans les deux états (activé / désactivé) :

| Scénario | Budget proposé | Méthode | Statut |
|---|---|---|---|
| Observabilité désactivée | 0 surcoût p50 mesurable | Pile HTTP complète, 0 et 300 routes | à valider |
| Observabilité `metrics` activée | ≤ 5 % de surcoût p50 | Même scénario, endpoint de collecte activé | à valider |
| Observabilité `traces` activée | ≤ 10 % de surcoût p50 | Même scénario, exportateur local | à valider |
| Génération de manifeste | Hors chemin chaud, CLI/dev uniquement | Revue d'architecture + mesure CLI | à valider |
| Validation schema-first | ≤ coût de la validation actuelle à champs équivalents | DTO de 8 champs, 20 000 itérations | à mesurer |
| Client généré | 0 impact runtime | Par construction, vérifié au build | à valider |
| Page de développement | 0 impact en production (non montée) | Test de démarrage production | à valider |
| Création de projet | ≤ 60 s hors installation réseau | Trois exécutions, médiane | à mesurer |

Règles :

- toute fonctionnalité opt-in est mesurée dans les deux états ;
- les benchmarks de la 002 sont ajoutés à la commande `bun run bench` existante ;
- la CI échoue si un budget de la 001 ou de la 002 est dépassé ;
- les résultats sont archivés en Markdown et JSON, comparables au tag précédent.

---

## 10. Historique

| Date | Version | Changement |
|---|---|---|
| 2026-11-26 | 1.0 | Baseline mesurée, prototypes routeur/trie, projections et budgets initiaux |
| 2026-11-27 | 1.1 | Révision de périmètre, renvoi vers la spec 002 et ajout des garde-fous de mesure associés |
