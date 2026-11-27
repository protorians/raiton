# Tasks — Framework optimization (spec 002)

## Phase 1 — Fondations

- [x] T001 Contrats schema-first (`source/contracts/`) : TypeBox, validation runtime, JSON Schema/OpenAPI, `@Input/@Output`, erreurs stables.
- [x] T002 Configuration : chargement `.ts/.mts/.cts/.js/.mjs/.cjs/.json`, validation par champ, schéma JSON, `defineConfigSync`.
- [x] T003 Catalogue d'erreurs stable (`source/framework/errors/catalog.ts`).
- [x] T004 Corrélation, métriques Prometheus, traces OTLP, readiness et arrêt gracieux (`source/framework/observability/`).
- [x] T005 Manifeste versionné + schéma publié + invalidation HMR (`source/manifest/`).

## Phase 2 — Surface CLI

- [x] T006 `raiton new` (api/minimal/mcp-agent, bun/node/deno, dry-run, offline, no-install, force).
- [x] T007 `raiton generate` (controller, service, repository, dto, mcp-tool, test, resource).
- [x] T008 `raiton routes`, `inspect`, `why`.
- [x] T009 `raiton doctor --json --fix`.
- [x] T010 `raiton openapi export`, `raiton client`, `raiton contract check|snapshot`.
- [x] T011 `raiton mcp list|inspect|test|serve|conformance`.
- [x] T012 `raiton docs agents` (+ `--check`).

## Phase 3 — IA, MCP et découvrabilité

- [x] T013 Transport stdio MCP.
- [x] T014 Schémas entrée/sortie, annotations de sûreté, default-deny destructif.
- [x] T015 Audit expurgé, scopes et limite de débit.
- [x] T016 Suite de conformité partagée HTTP/stdio.
- [x] T017 Page de développement et suggestion de route 404.
- [x] T018 UI OpenAPI par défaut + endpoint JSON.

## Phase 4 — Documentation et validation

- [x] T019 Recettes exécutables et index FR/EN.
- [x] T020 `llms.txt`, `llms-full.txt`, `AGENTS.md`, `CLAUDE.md`, docs générées.
- [x] T021 Déclarations TypeScript générées au build.
- [x] T022 Tests : contrats, manifeste, MCP HTTP+stdio, observabilité, configuration, générateurs, découvrabilité.
- [x] T023 Non-régression : suite existante à 100 %, chemin chaud opt-in.

## Vérification

```bash
bun test tests
bunx tsc --noEmit -p tsconfig.json
bun run build:types
```

Résultats de cette implémentation : 47 tests passent, `tsc --noEmit` est propre, les déclarations sont générées, le harnais `scripts/bench.ts --check` respecte les budgets.
