# Feature Specification: Optimisation des performances de Raiton (dev & production)

**Feature Branch**: `001-performance-optimization` (branche non créée)

**Created**: 2026-11-26

**Status**: Draft — révisé le 2026-11-27

**Input**: User description: « Le but véritable est de gagner de la performance en dev mais plus de performance en prod. »

**Révision**: 2026-11-27 — périmètre confirmé : cette spec couvre uniquement le coût d'exécution (routage, démarrage, HMR, validation, body parsing). Les volets adoption, contrats, IA et observabilité sont cadrés par la spec 002.

**Specifications liées** : [002-framework-optimization](../002-framework-optimization/spec.md)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Production à coût de routage constant (Priority: P1)

En tant qu'opérateur d'une application Raiton en production, je veux que le coût de traitement d'une requête ne dépende pas du nombre de routes enregistrées, afin que le débit reste élevé et prévisible quand l'application grandit.

**Why this priority**: C'est l'objectif principal. Aujourd'hui, avec 300 routes et une route cible enregistrée en dernier, une requête triviale coûte environ **131 µs** dans la pile complète (hors réseau), soit ~7 600 req/s sur un cœur. La même requête avec la cible en premier coûte ~2,1 µs (~469 000 req/s) : le coût dépend de l'ordre d'enregistrement, ce qui est inacceptable en production.

**Independent Test**: Enregistrer 300 routes, placer la route cible en dernière position, appeler la pile HTTP avec une requête `GET` triviale, et comparer au scénario à 1 route. Le test est indépendant du handler métier et du réseau.

**Acceptance Scenarios**:

1. **Given** 300 routes enregistrées et la route cible en dernière position, **When** une requête `GET` cible cette route, **Then** le surcoût framework est ≤ 5 µs par requête sur la machine de référence (hors handler, réseau et sérialisation JSON).
2. **Given** la route cible enregistrée en première, au milieu ou en dernière position, **When** on mesure le matching, **Then** l'écart p50 entre ces positions est ≤ 2×.
3. **Given** 1 000 routes enregistrées, **When** on mesure une requête triviale, **Then** le surcoût reste ≤ 2× celui observé avec 100 routes.
4. **Given** deux requêtes concurrentes sur `/users/1` et `/users/2`, **When** elles sont traitées simultanément, **Then** chaque handler reçoit uniquement ses propres paramètres.
5. **Given** une route avec `@ApiResponse({ type })` en production, **When** le handler retourne une réponse valide, **Then** la réponse, le statut et les en-têtes sont identiques à aujourd'hui, sans exécuter de validation de réponse coûteuse.

---

### User Story 2 - Développement réactif avec HMR préservé (Priority: P2)

En tant que développeur, je veux bénéficier des mêmes gains sur le serveur de développement et garder un HMR fiable, afin d'itérer vite sans redémarrer ni accumuler des routes ou middlewares fantômes.

**Why this priority**: Les gains doivent être perceptibles en dev, mais ils ne doivent jamais casser le rechargement à chaud. Le HMR est un contrat du framework : contrôleur, middleware, hook, DI, socket, MCP, scheduler et cache doivent rester rechargeables.

**Independent Test**: Modifier 30 fois un contrôleur à 3 routes, puis vérifier que le nombre de routes reste 3, que l'ancien chemin ne répond plus et que le nouveau répond. Répéter pour un middleware, un hook et une route `@Cache`.

**Acceptance Scenarios**:

1. **Given** un contrôleur à 3 routes chargé en dev, **When** le fichier est modifié puis rechargé 30 fois, **Then** le routeur contient toujours exactement 3 routes correspondantes et le reload p50 reste ≤ 2 ms.
2. **Given** un middleware global chargé, **When** son fichier est modifié, **Then** il est remplacé une seule fois et la taille de la pile de middlewares reste stable.
3. **Given** un hook `onRequest` ou `onResponse`, **When** son fichier est modifié, **Then** il est remplacé sans duplication et le comportement est immédiatement actif.
4. **Given** une route décorée `@Cache`, **When** le handler est modifié, **Then** l'ancienne entrée de cache de cette route n'est plus servie.
5. **Given** le mode développement, **When** une réponse décorée `@ApiResponse({ type })` est produite, **Then** la validation de réponse reste active (comportement de développement conservé).

---

### User Story 3 - Framework plus léger au démarrage (Priority: P3)

En tant que consommateur du framework, je veux que le démarrage et l'empreinte mémoire soient plus faibles, afin de réduire le temps de boot, le coût des conteneurs et le poids du paquet publié.

**Why this priority**: Après le chemin chaud, le démarrage est le deuxième coût visible. L'import à froid de l'entrée `framework` mesure aujourd'hui ~135 ms (dont ~124 ms au-dessus du runtime nu), et l'entrée `decorators` ~130 ms parce qu'elle charge indirectement tout le framework.

**Independent Test**: Mesurer dans un processus neuf l'import de l'entrée `framework`, puis l'import du sous-chemin `decorators`, et vérifier qu'aucune dépendance lourde optionnelle (argon2, bcrypt, class-validator, esbuild) n'est chargée si la fonctionnalité correspondante n'est pas utilisée.

**Acceptance Scenarios**:

1. **Given** un processus neuf, **When** on importe l'entrée `framework`, **Then** le temps d'import médian est ≤ 60 ms sur la machine de référence.
2. **Given** un processus neuf, **When** on importe uniquement le sous-chemin `decorators`, **Then** le temps d'import médian est ≤ 30 ms.
3. **Given** une application qui n'utilise ni Argon2, ni Bcrypt, ni la validation par décorateurs, **When** elle démarre, **Then** ces dépendances ne sont pas chargées.
4. **Given** un projet de 5 000 fichiers source, **When** le builder classe les artefacts au démarrage, **Then** le coût de classification est réduit d'au moins 50 % par rapport à aujourd'hui (~10,7 ms mesurés).

---

### User Story 4 - Preuves de performance continues (Priority: P3)

En tant que mainteneur, je veux une suite de benchmarks reproductible et des budgets en CI, afin qu'une régression de performance soit détectée avant publication.

**Why this priority**: Sans mesure automatisée, les optimisations ne sont pas défendables et les régressions reviennent silencieusement.

**Independent Test**: Lancer la commande de benchmark dans un checkout propre, obtenir un rapport p50/p90, puis introduire volontairement une régression et vérifier que la CI échoue.

**Acceptance Scenarios**:

1. **Given** un checkout propre, **When** on lance la suite de benchmarks, **Then** un rapport lisible (Markdown et/ou JSON) est produit avec p50, p90, req/s et mémoire.
2. **Given** une régression de plus de 10 % sur un budget p50, **When** la CI s'exécute, **Then** le job échoue avec le scénario et la valeur fautive.
3. **Given** une release, **When** on compare au tag précédent, **Then** les métriques sont archivées et comparables.

---

### Edge Cases

- Application sans aucune route, avec une seule route, puis avec 1 000 routes.
- Route cible en première, au milieu et en dernière position d'enregistrement.
- Routes statiques, paramétriques (`/:id`), profondes (`/a/:b/c/:d`) et route sans correspondance.
- Deux routes de même chemin avec des versions différentes.
- Requêtes concurrentes sur la même route avec des paramètres différents.
- Handlers synchrones, asynchrones, retournant `Response`, `ThrowableResponse` ou `HttpException`.
- Payload absent, JSON de 547 octets, JSON de 10 Ko, `application/x-www-form-urlencoded`, `multipart/form-data`.
- Middlewares : 0, 3, 6 et 10 dans la pile ; middleware remplacé à chaud.
- Mode production sans HMR ; mode développement avec HMR ; redémarrage Node par IPC.
- Dépendances optionnelles absentes (argon2, bcrypt, class-validator, redis, amqplib).
- Runtime Bun, Node et Deno : comportement et budgets équivalents, à tolérance de mesure près.
- Édition d'un contrôleur qui change le chemin, la méthode ou le nom de classe (limite HMR existante à documenter).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Le coût de résolution d'une route MUST être indépendant du nombre total de routes pour les routes statiques, et proportionnel uniquement au nombre de segments pour les routes paramétriques.
- **FR-002**: Les motifs de route MUST être compilés une seule fois, à l'enregistrement, et jamais pendant le traitement d'une requête.
- **FR-003**: Les paramètres extraits MUST être propres à chaque requête ; aucun état mutable partagé entre requêtes ne doit porter les paramètres d'une route.
- **FR-004**: Les opérations d'ajout, de suppression, de remplacement et de réinitialisation MUST maintenir tous les index cohérents, sans doublon, y compris lors d'un recompile HMR.
- **FR-005**: La validation de réponse MUST être configurable ; elle MUST être désactivée par défaut en production et rester active en développement/HMR.
- **FR-006**: Les métadonnées nécessaires à un handler (paramètres, middlewares de route, validateur de réponse, options de cache) MUST être calculées une seule fois à la compilation du handler, pas à chaque requête.
- **FR-007**: Sur Node, les en-têtes d'une requête MUST être convertis au plus une fois par requête et réutilisés pour tous les accès.
- **FR-008**: Le body parser MUST être installé une seule fois, parser l'URL une seule fois, ne pas parser de query absente, et utiliser le chemin de lecture de corps le plus direct offert par le runtime.
- **FR-009**: Le HMR MUST invalider les chaînes de middlewares, les hooks et les entrées de cache de route concernées ; le mécanisme de réimport avec paramètre de version et d'horodatage MUST être conservé.
- **FR-010**: Les mémoïsations du conteneur d'injection MUST être indexées par constructeur (et non par nom) ou invalidées lors d'un `updateConstruct`, afin qu'un rechargement HMR ne résolve jamais une ancienne classe.
- **FR-011**: Les dépendances lourdes et optionnelles (argon2, bcrypt, class-validator, esbuild, redis, amqplib) MUST être chargées paresseusement, uniquement lorsqu'elles sont réellement utilisées.
- **FR-012**: Les points d'entrée runtime MUST ne pas charger les adaptateurs ou modules d'un runtime non utilisé quand un sous-chemin dédié existe.
- **FR-013**: Une suite de benchmarks MUST couvrir routage, pile HTTP, validation, corps de requête, démarrage et reload HMR ; elle MUST produire des métriques comparables et des budgets vérifiables en CI.
- **FR-014**: Les API publiques MUST rester compatibles ; les applications existantes doivent fonctionner sans modification.
- **FR-015**: Pour des entrées identiques, les réponses (corps, statut, en-têtes) MUST rester identiques à la version actuelle.
- **FR-016**: Le classement des artefacts au démarrage MUST être réduit à un lookup par fichier et le répertoire source MUST être lu une seule fois.

### Key Entities *(include if feature involves data)*

- **Route indexée** : représentation d'une route avec méthode, chemin normalisé, segments, paramètres, motif compilé et handler ; doit être identifiable pour suppression/remplacement.
- **Contexte de handler compilé** : ensemble figé des métadonnées d'une route (paramètres, middlewares, validateur de réponse, cache) créé une fois par compilation.
- **Scénario de benchmark** : nom, nombre de routes, position de la cible, type de route, nombre de middlewares, taille de payload, mode (dev/prod), métriques p50/p90/req/s/mémoire.
- **Budget de performance** : seuil maximal ou minimal par scénario, utilisé par la CI.
- **Événement d'invalidation HMR** : changement d'un contrôleur, middleware, hook, artefact DI, socket, MCP, scheduler ou cache, avec les index à mettre à jour.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En production, avec 300 routes et la cible en dernier, le surcoût framework par requête triviale passe de ~131 µs à **≤ 5 µs** (gain ≥ 26×), soit un débit de référence **≥ 250 000 req/s** sur un cœur dans le harnais de benchmark.
- **SC-002**: Le coût de matching ne varie plus de plus de **2×** selon la position d'enregistrement de la route cible (aujourd'hui : 0,375 µs en premier vs 134 µs en dernier, soit ~358×).
- **SC-003**: En production, une réponse portant `@ApiResponse({ type })` économise **≥ 15 µs** par requête par rapport à aujourd'hui (validation mesurée à 18,5 µs pour un DTO de 8 champs décorés).
- **SC-004**: Une requête `POST` avec un corps JSON de 547 octets économise **≥ 8 µs** sur la lecture du corps (lecture manuelle mesurée à 12,3 µs contre 1,9 µs avec le chemin natif).
- **SC-005**: En développement, le reload d'un contrôleur à 3 routes reste **≤ 2 ms p50** (mesure actuelle : 0,6 ms p50, 1,1 ms p90) et aucun doublon de route, middleware ou hook n'apparaît après 30 reloads.
- **SC-006**: Le démarrage à froid passe de ~135 ms à **≤ 60 ms** pour l'entrée `framework`, et de ~130 ms à **≤ 30 ms** pour le sous-chemin `decorators`.
- **SC-007**: La suite existante et les nouveaux tests de concurrence, HMR et compatibilité passent à 100 % ; aucune régression fonctionnelle n'est acceptée.
- **SC-008**: Les benchmarks sont reproductibles avec une variance p50 **< 10 %** sur la machine de référence, et la CI échoue au-delà des budgets définis.

## Assumptions

- Machine de référence : Apple Silicon (darwin), Bun 1.4.2, Node 22.20.0, processus unique, cache système chaud, réseau exclu.
- Les mesures sont des médianes sur plusieurs exécutions ; une variance de ±10 à ±20 % est admise sur les micro-benchmarks.
- Les scénarios de production excluent le réseau et la sérialisation JSON, sauf mention contraire ; les scénarios de développement incluent le HMR actif.
- Les applications ciblées vont de 10 à 1 000 routes, avec 0 à 10 middlewares globaux.
- Aucun changement d'API publique cassant n'est autorisé ; les structures internes (routeur, pipeline, métadonnées) peuvent évoluer.
- Les dépendances optionnelles peuvent devenir des dépendances pairs/optionnelles, à condition que leur absence produise une erreur claire uniquement à l'usage.
- Le HMR reste un contrat : les tests de non-régression HMR font partie de la définition de « terminé ».
- Les chiffres de référence et leur méthodologie sont documentés dans `metrics.md`, annexe technique de cette spécification.

## Périmètre et specifications liées

- **001-performance-optimization** reste l'autorité sur le coût d'exécution : routage, démarrage à froid, HMR, validation de réponse, body parsing, middlewares et empreinte mémoire.
- **002-framework-optimization** couvre l'adoption, les contrats typés, l'outillage IA, l'observabilité et la découvrabilité. Elle ne peut pas modifier les budgets définis ici.
- Les deux specs partagent le même harnais de mesure. Toute fonctionnalité de la 002 doit être mesurée avec le protocole décrit dans `metrics.md`.
- Une fonctionnalité de la 002 ne peut être déclarée terminée si elle dégrade un budget de la 001.
- Les invariants de compatibilité (aucune rupture d'API publique, HMR préservé, réponses identiques à entrées identiques) s'appliquent aux deux specs.
