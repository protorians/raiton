# Feature Specification: Optimisation de l'écosystème — adoption, contrats et compatibilité IA

**Feature Branch**: `002-framework-optimization` (branche non créée)

**Created**: 2026-11-27

**Status**: Implemented (2026-11-27)

**Input**: User description: « Rendre le framework plus pro/avancé, plus AI-friendly et plus facile à découvrir, tout en préservant les budgets de performance de la spec 001. »

**Specifications liées** : [001-performance-optimization](../001-performance-optimization/spec.md)

## Périmètre

### Inclus

- création de projet et génération d'artifacts ;
- inventaire machine-readable du projet et outillage de diagnostic ;
- configuration typée et validée au démarrage ;
- contrats uniques pour la validation, les types et la documentation API ;
- découverte et usage du framework par des agents IA, y compris le transport MCP standard entrée/sortie ;
- observabilité, corrélation et catalogue d'erreurs ;
- page de développement et documentation actionnable ;
- compatibilité ascendante et non-régression des budgets de performance.

### Exclu (specs futures)

- authentification complète, RBAC/ABAC et gestion de secrets ;
- couche de persistance, migrations et transactions ;
- résilience réseau des appels sortants (retry, circuit breaker) ;
- mode cluster et orchestration multi-processus ;
- messagerie métier, i18n applicative et rendu frontend.

Ces exclusions ne doivent pas être bloquées par l'architecture retenue : les points d'extension correspondants doivent rester ouverts.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Première application fonctionnelle en moins de cinq minutes (Priority: P1)

En tant que développeur qui découvre Raiton, je veux créer, démarrer et tester une application sans lire toute la documentation ni éditer de fichier, afin de juger le framework sur une expérience réelle.

**Why this priority**: La découverte est aujourd'hui le principal frein : la CLI expose peu de commandes, deux sont des stubs, et le premier démarrage dépend de conventions non vérifiées. Sans ce parcours, les fonctionnalités avancées restent invisibles.

**Independent Test**: Sur une machine propre disposant d'un runtime supporté, exécuter la commande de création documentée, démarrer le projet, appeler les endpoints d'exemple et lancer les tests inclus, sans édition manuelle.

**Acceptance Scenarios**:

1. **Given** une machine propre avec un runtime supporté et un accès réseau, **When** le développeur exécute la commande de création documentée avec des options explicites, **Then** un projet est créé, les dépendances sont installées et aucun fichier ne doit être modifié avant le premier démarrage.
2. **Given** le projet généré, **When** le développeur le démarre en mode développement, **Then** le processus signale qu'il est prêt et l'endpoint de santé documenté répond avec succès.
3. **Given** le projet généré, **When** le développeur appelle la route d'exemple documentée, **Then** la réponse est valide et cohérente avec la documentation générée.
4. **Given** le projet généré, **When** le développeur exécute la commande de test documentée, **Then** tous les tests inclus passent.
5. **Given** un environnement d'intégration continue sans terminal interactif, **When** la création s'exécute avec des options explicites, **Then** aucune invite n'est émise et le code de sortie est stable.
6. **Given** une option invalide ou un prérequis manquant, **When** la création échoue, **Then** le message identifie la cause, propose une action corrective et retourne un code de sortie non nul.

---

### User Story 2 - Contrats uniques, typés et vérifiables (Priority: P1)

En tant que développeur d'une API de production, je veux définir la forme des entrées et sorties une seule fois, afin que la validation runtime, les types TypeScript, le client et la documentation restent cohérents.

**Why this priority**: La validation actuelle est portée par un seul mécanisme de décorateurs, la documentation est générée séparément et aucun client typé n'est produit. Toute évolution du contrat se traduit par de la duplication et des dérives.

**Independent Test**: Déclarer une route avec un schéma d'entrée et de sortie, envoyer une charge invalide, vérifier le rejet avant exécution, envoyer une charge valide, générer le client et la documentation, puis compiler le client en mode strict.

**Acceptance Scenarios**:

1. **Given** une route déclarant un schéma d'entrée, **When** une requête porte une charge invalide, **Then** le handler n'est pas exécuté et la réponse est un 4xx stable avec chemins de champs et codes d'erreur.
2. **Given** la même route, **When** une charge valide est envoyée, **Then** le handler reçoit des valeurs dont la forme runtime et le type à la compilation dérivent du même schéma.
3. **Given** une route déclarant un schéma de sortie, **When** le handler retourne une valeur invalide en développement, **Then** l'écart est signalé avec la route et le champ fautif ; en production, la validation de sortie est désactivée par défaut.
4. **Given** le catalogue de routes, **When** un client typé est généré, **Then** il compile en mode strict sans `any` dans les signatures publiques des routes.
5. **Given** les mêmes schémas, **When** la documentation API est générée, **Then** les schémas d'entrée et de sortie sont présents et identiques au contrat d'exécution.
6. **Given** un contrat publié, **When** une rupture est introduite, **Then** le contrôle d'intégration continue échoue en nommant la route et le champ concernés.

---

### User Story 3 - Découverte et usage par un agent IA (Priority: P1)

En tant qu'agent IA ou assistant de développement, je veux obtenir une vérité machine sur le projet et appeler ses outils de manière déterministe, afin d'aider un développeur sans deviner les conventions.

**Why this priority**: Le support MCP existe déjà, mais il faut connaître le projet pour l'utiliser, le transport est limité au HTTP et les outils ne sont pas découvrables par un agent. C'est l'atout le plus différenciant du framework.

**Independent Test**: Depuis un projet neuf, exécuter la commande d'inventaire, valider le manifeste obtenu, se connecter au serveur MCP en entrée/sortie standard, lister les outils puis en appeler un.

**Acceptance Scenarios**:

1. **Given** un projet, **When** un agent exécute la commande d'introspection documentée, **Then** il reçoit un manifeste listant routes, artifacts, dépendances d'injection, clés de configuration, variables d'environnement, outils MCP et emplacements source.
2. **Given** le manifeste, **When** il est validé contre le schéma publié, **Then** il est conforme et sa version de schéma est explicite.
3. **Given** le même projet, **When** la commande de documentation pour agents s'exécute, **Then** elle produit un index compact et une référence complète générés depuis le manifeste et le guide utilisateur, sans édition manuelle.
4. **Given** un serveur MCP déclaré dans le projet, **When** un client se connecte via le transport entrée/sortie standard, **Then** il peut lister et appeler les outils avec leurs schémas d'entrée et annotations de sûreté.
5. **Given** un outil marqué destructif, **When** le serveur démarre sans autorisation explicite, **Then** l'outil n'est pas exposé.
6. **Given** une commande de diagnostic ou de génération en mode non interactif, **When** elle se termine, **Then** elle émet un JSON valide sur la sortie standard et un code de sortie stable.

---

### User Story 4 - Exploitation et diagnostic en production (Priority: P2)

En tant qu'opérateur, je veux corréler les requêtes, mesurer le comportement et obtenir des erreurs actionnables, afin d'exploiter une application Raiton sans outillage maison.

**Why this priority**: Le framework fournit un health-check mais pas de corrélation, de métriques, de traces ni de catalogue d'erreurs. Les applications deviennent difficiles à diagnostiquer dès qu'elles quittent le poste de développement.

**Independent Test**: Démarrer une application avec observabilité activée, émettre des requêtes valides et invalides, vérifier l'identifiant de corrélation dans les logs et la réponse, lire les métriques, provoquer un arrêt et vérifier le drainage.

**Acceptance Scenarios**:

1. **Given** une requête entrante, **When** elle est traitée, **Then** les logs portent un identifiant de corrélation et la réponse expose le même identifiant.
2. **Given** l'observabilité activée, **When** du trafic est traité, **Then** les métriques de latence, de débit et d'erreur sont exposées dans un format standard de collecte.
3. **Given** la traçabilité activée, **When** une requête déclenche un appel sortant, **Then** les opérations entrante et sortante appartiennent à la même trace.
4. **Given** une erreur gérée, **When** elle est retournée en production, **Then** le corps contient un code stable, le statut HTTP et un lien de documentation, sans trace de pile.
5. **Given** un signal d'arrêt, **When** l'arrêt commence, **Then** la disponibilité échoue immédiatement, les requêtes en cours se terminent dans une limite configurable et le processus sort avec succès.
6. **Given** une configuration invalide, **When** l'application démarre, **Then** elle échoue immédiatement avec des erreurs par champ et n'ouvre pas de port d'écoute.

---

### User Story 5 - Découvrabilité au quotidien (Priority: P2)

En tant que développeur qui maintient une application, je veux voir ce que le framework a réellement monté et comprendre l'origine d'une route, afin de ne pas dépendre de la mémoire ou de la lecture du code interne.

**Why this priority**: Les décorateurs et les artifacts rendent le montage implicite. Une page de développement et des commandes d'explication transforment cette magie en objet observable.

**Independent Test**: Lancer l'application en développement, ouvrir la page de développement documentée, envoyer une requête vers une route inconnue et demander l'origine d'une route existante.

**Acceptance Scenarios**:

1. **Given** une application en développement, **When** le développeur ouvre la page de développement documentée, **Then** les routes, artifacts, dépendances d'injection, état de santé et documentation API sont visibles sans configuration supplémentaire.
2. **Given** une route inconnue en développement, **When** une requête est émise, **Then** la réponse suggère la route connue la plus proche.
3. **Given** une route montée, **When** le développeur demande son origine, **Then** la commande indique le fichier source, le décorateur et l'artifact qui l'ont enregistrée.
4. **Given** un projet avec des prérequis manquants, **When** la commande de diagnostic s'exécute, **Then** elle liste chaque problème avec une sévérité et une action corrective.
5. **Given** un décorateur public ou une commande documentée, **When** la documentation est construite, **Then** une recette exécutable en un fichier existe pour cet élément.

---

### Edge Cases

- Machine sans accès réseau pendant la création de projet : un mode hors ligne ou un message explicite doit exister.
- Répertoire cible non vide : aucun fichier existant ne doit être écrasé sans option explicite.
- Absence de terminal interactif ou sortie redirigée : aucune invite, sortie JSON valide.
- Plusieurs runtimes installés ou runtime non supporté : détection explicite et message actionnable.
- Schémas récursifs, unions, types optionnels et tableaux : validation, types et documentation restent cohérents.
- Modification d'un contrôleur pendant la génération du manifeste : l'inventaire reste cohérent ou signale un état instable.
- Outil MCP destructif ou portant sur des données sensibles : non exposé par défaut, journalisé lorsqu'autorisé.
- Observabilité désactivée : aucun coût mesurable sur le chemin chaud.
- Projet sans route, avec une route, puis avec mille routes : les budgets de la spec 001 restent la référence.
- Configuration en TypeScript, JavaScript ou JSON : le comportement documenté est identique.
- Documentation en français et en anglais : les deux versions décrivent le même contrat.

---

## Requirements *(mandatory)*

### Functional Requirements

#### Onboarding et génération

- **FR-001**: Le framework MUST fournir une commande de création de projet produisant un projet démarrable, testable et documenté, avec des modèles couvrant au minimum une API HTTP, un service minimal et un serveur MCP.
- **FR-002**: La création MUST fonctionner sans terminal interactif, accepter des options explicites (nom, modèle, runtime, répertoire) et ne MUST exiger aucune édition manuelle avant le premier démarrage.
- **FR-003**: Le projet généré MUST inclure une route d'exemple, un test qui passe, un fichier d'exemple de variables d'environnement et la documentation de démarrage.
- **FR-004**: Le framework MUST fournir des générateurs d'artifacts (contrôleur, service, dépôt, DTO, test, outil MCP) dont la sortie compile et dont les tests générés passent.
- **FR-005**: La création et la génération MUST refuser d'écraser un fichier existant sans option explicite et MUST proposer un mode de simulation.

#### Inventaire, CLI et diagnostic

- **FR-006**: Le framework MUST exposer un inventaire machine-readable du projet comprenant routes, artifacts, graphe d'injection, clés de configuration, variables d'environnement, outils MCP, versions et emplacements source.
- **FR-007**: L'inventaire MUST être versionné et validable par un schéma publié.
- **FR-008**: Toutes les commandes de diagnostic, d'inventaire et de génération MUST supporter une sortie JSON, des codes de sortie stables et un mode non interactif.
- **FR-009**: Toute erreur de commande MUST inclure un code stable, un message, une action corrective et un lien de documentation.
- **FR-010**: Une commande de diagnostic MUST vérifier l'environnement, la configuration, les décorateurs, les versions, les ports et les prérequis, avec une sévérité par problème et une correction proposée.
- **FR-011**: Le framework MUST permettre d'identifier, pour une route donnée, le fichier, le décorateur et l'artifact qui l'ont enregistrée.

#### Configuration

- **FR-012**: Le fichier de configuration TypeScript MUST être chargé comme documenté, et la fonction de définition MUST fournir le typage et la validation.
- **FR-013**: La configuration MUST être validée au démarrage ; une valeur invalide MUST empêcher l'écoute et produire des erreurs par champ.
- **FR-014**: Un schéma JSON de configuration MUST être publiable pour l'autocomplétion et la validation dans les éditeurs.

#### Contrats et documentation API

- **FR-015**: Une définition de schéma unique MUST alimenter la validation runtime, les types TypeScript et la documentation API.
- **FR-016**: Une entrée invalide MUST produire une réponse 4xx stable avec chemins de champs et codes, sans exécuter le handler.
- **FR-017**: La validation de sortie MUST être activée en développement et désactivée par défaut en production.
- **FR-018**: Un client typé MUST pouvoir être généré depuis le catalogue de routes, sans `any` dans les signatures publiques.
- **FR-019**: Une rupture de contrat publié MUST être détectable en intégration continue avec la route et le champ concernés.
- **FR-020**: La documentation API MUST refléter les mêmes schémas que la validation runtime.

#### Compatibilité IA et MCP

- **FR-021**: Les serveurs MCP MUST supporter le transport entrée/sortie standard en plus du transport HTTP.
- **FR-022**: Les outils MCP MUST exposer un schéma d'entrée, un schéma de sortie lorsque pertinent et des annotations de sûreté.
- **FR-023**: Les outils destructifs MUST être non exposés par défaut et nécessiter une autorisation explicite.
- **FR-024**: Les appels MCP MUST pouvoir être authentifiés, limités en débit, audités et expurgés des secrets.
- **FR-025**: Le framework MUST générer une documentation destinée aux agents à partir de l'inventaire et du guide utilisateur.

#### Observabilité et exploitation

- **FR-026**: Chaque requête MUST recevoir un identifiant de corrélation présent dans les logs et la réponse.
- **FR-027**: Les traces et métriques MUST pouvoir être exportées vers des standards ouverts, et un endpoint de collecte MUST être disponible lorsqu'activé.
- **FR-028**: Les erreurs MUST suivre un catalogue stable code/statut/lien de documentation, sans trace de pile en production.
- **FR-029**: L'arrêt MUST drainer les requêtes en cours dans une limite configurable et faire échouer la disponibilité dès le début de l'arrêt.
- **FR-030**: Le framework MUST ne pas régresser les budgets de performance de la spec 001 lorsque les fonctionnalités d'observabilité et de contrat sont désactivées.

#### Compatibilité et cycle de vie

- **FR-031**: Les applications existantes MUST continuer à fonctionner sans modification ; aucune API publique ne MUST être cassée sans cycle de dépréciation.
- **FR-032**: Les fonctionnalités optionnelles MUST rester opt-in lorsque leur coût ou leur surface de sécurité le justifie.

### Key Entities *(include if feature involves data)*

- **Projet généré** : modèle, runtime, dépendances, route d'exemple, tests, documentation et fichier d'environnement produits par la création.
- **Contrat de route** : méthode, chemin, schéma d'entrée, schéma de sortie, erreurs documentées et version.
- **Schéma de contrat** : définition unique utilisée pour la validation, les types et la documentation.
- **Inventaire de projet** : manifeste versionné des routes, artifacts, dépendances d'injection, configuration, variables d'environnement, outils MCP et emplacements source.
- **Outil MCP** : nom, description, schémas d'entrée et de sortie, annotations de sûreté, scopes et politique d'exposition.
- **Diagnostic** : problème détecté, sévérité, cause, remédiation proposée et code stable.
- **Identifiant de corrélation** : identifiant unique propagé des logs vers la réponse et la trace.
- **Catalogue d'erreurs** : correspondance entre code stable, statut HTTP, message public et lien de documentation.
- **Recette documentaire** : fonctionnalité, exemple exécutable en un fichier et résultat attendu.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un développeur sur une machine propre crée, démarre et teste une application en **moins de 5 minutes**, sans édition manuelle, à partir de la commande documentée.
- **SC-002**: **100 %** des modèles générés démarrent et passent leurs tests sur les runtimes annoncés.
- **SC-003**: **0 invite interactive** en mode non interactif ; **100 %** des commandes concernées produisent un JSON valide sur la sortie standard.
- **SC-004**: **100 %** des erreurs CLI exposent un code, une action corrective et un lien de documentation.
- **SC-005**: Un contrat de route est défini **une seule fois** ; **0 duplication** entre validation, types et documentation sur le projet de référence.
- **SC-006**: **100 %** des charges invalides sont rejetées avant exécution du handler, avec un format d'erreur stable.
- **SC-007**: Le client généré compile en TypeScript strict avec **0 `any`** dans les signatures publiques.
- **SC-008**: L'inventaire couvre **100 %** des routes, artifacts, outils MCP et variables d'environnement du projet de référence, et valide son schéma.
- **SC-009**: Les transports MCP entrée/sortie standard et HTTP passent **la même suite de conformité**.
- **SC-010**: **0 outil destructif** n'est exposé sans autorisation explicite.
- **SC-011**: **100 %** des requêtes tracées possèdent un identifiant de corrélation reliant log, réponse et trace.
- **SC-012**: L'observabilité activée ajoute **au plus 5 % de surcoût p50** sur le harnais de la spec 001 ; désactivée, elle ajoute **0**.
- **SC-013**: L'arrêt draine les requêtes en cours dans la limite configurée dans **100 %** des tests de résilience.
- **SC-014**: Une configuration invalide empêche l'écoute dans **100 %** des cas, avec des erreurs par champ.
- **SC-015**: **100 %** des erreurs HTTP exposent un code stable, un statut et un lien de documentation, sans trace de pile en production.
- **SC-016**: Chaque décorateur public et chaque commande documentée possède une **recette exécutable** ; **0 export public** sans documentation.
- **SC-017**: La suite existante passe à **100 %** et **aucune application de référence** ne nécessite de modification.

---

## Assumptions

- **Bun** reste le runtime principal ; Node.js et Deno doivent conserver une parité fonctionnelle, à tolérance d'implémentation près.
- La création de projet dispose d'un accès réseau par défaut ; un mode hors ligne peut être proposé sans être obligatoire.
- Les budgets de la spec `001-performance-optimization` restent la référence pour le coût d'exécution et ne peuvent pas être dégradés.
- Les contrats existants (HMR, artifacts, plugins, décorateurs, MCP HTTP) sont préservés ; les nouveautés sont additives ou opt-in.
- La page de développement est montée uniquement en développement et ne doit jamais être exposée en production par défaut.
- La documentation est produite en français et en anglais ; les deux versions décrivent le même contrat.
- Les fonctionnalités d'authentification, de persistance et de résilience réseau sont hors périmètre de cette spec et feront l'objet de specs dédiées.
- Les modèles de projet et les générateurs sont maintenus dans le dépôt et versionnés avec le framework.
- Un cycle de dépréciation est obligatoire avant toute suppression d'API publique.

---

## Périmètre et specifications liées

- **001-performance-optimization** reste l'autorité sur le coût d'exécution : routage, démarrage, HMR, validation et body parsing.
- **002-framework-optimization** couvre l'adoption, les contrats, l'outillage IA, l'observabilité et la découvrabilité.
- Les deux specs partagent le même harnais de mesure. Toute fonctionnalité de la 002 doit être mesurée avec le protocole de `001/metrics.md`, en particulier l'observabilité, la génération de manifeste et la validation schema-first.
- Une fonctionnalité de la 002 ne peut être déclarée terminée si elle dégrade un budget de la 001.
