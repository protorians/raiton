# Implementation Plan — Framework optimization (spec 002)

**Feature**: `specs/002-framework-optimization/spec.md`
**Status**: implemented in this change set

## Lots d'implémentation

1. **Contrats schema-first** — `source/contracts/` (TypeBox, validation runtime, dérivation JSON Schema/OpenAPI, décorateurs `@Input`/`@Output`).
2. **Configuration** — chargement `.ts`/`.mts`/`.cts`, validation par champ, schéma JSON publié, `defineConfig` typé.
3. **Inventaire de projet** — `source/manifest/` (manifeste versionné, schéma TypeBox, cache invalidé par HMR, introspection CLI).
4. **CLI** — `new`, `generate`, `routes`, `inspect`, `why`, `doctor`, `openapi`, `client`, `contract`, `mcp`, `docs`.
5. **MCP** — annotations de sûreté, schémas entrée/sortie, default-deny destructif, audit/rate-limit, transport stdio + suite de conformité partagée HTTP/stdio.
6. **Observabilité** — corrélation, métriques Prometheus, traces OTLP, catalogue d'erreurs, readiness et arrêt gracieux.
7. **Découvrabilité** — page de développement, suggestion de route 404, UI OpenAPI par défaut.
8. **Documentation** — guide FR/EN, `llms.txt`, `llms-full.txt`, `AGENTS.md`, recettes, docs générées.
9. **Tests** — contrats, manifeste/schéma, CLI, MCP HTTP+stdio, observabilité, configuration.

## Règles

- Toutes les nouveautés sont opt-in ou additives.
- Les fonctionnalités désactivées ne s'exécutent pas sur le chemin chaud.
- Aucun export public existant n'est supprimé.
