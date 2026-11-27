## [6.11.0-beta.29](https://github.com/protorians/raiton/compare/v6.10.0-beta.28...v6.11.0-beta.29) (2026-11-27)

### Features

* feat(debug): livrer le debug runtime assisté par IA ([a88e078](https://github.com/protorians/raiton/commit/a88e078ea8046c5961b2faa10c4da61b195faf9e))

### Bug Fixes

* chore(gitignore): ignorer les specs à tous les niveaux ([a5d7d4e](https://github.com/protorians/raiton/commit/a5d7d4e885958d7f1cba55d3f420852c8eca88d4))
* docs(specs): déclarer implémentée la spec 003 de debug runtime ([d10ed61](https://github.com/protorians/raiton/commit/d10ed61332c9bb85328bb12a48f5ebebea9a81c1))
* docs(debug): documenter les commandes, la configuration et le MCP de debug ([1edbfd2](https://github.com/protorians/raiton/commit/1edbfd2cd951f8c1a1e2d24d7aabf59cbfb60db7))
* perf(debug): mesurer le coût du journal et l'économie de tokens du debug ([fe47a5d](https://github.com/protorians/raiton/commit/fe47a5d7763fc4166bfeca97020e4816811b0e0b))

### Other Changes

* test(debug): couvrir le journal, les commandes et le serveur MCP de debug ([6edbd30](https://github.com/protorians/raiton/commit/6edbd30599a2deebad1d4c9a39726e6902e48058))

## Unreleased

### Features

* **debug**: AI-assisted runtime debug (spec 003) — `raiton call`, `requests`, `explain`, `replay` and `verify`; bounded in-memory request journal with redaction, timeline, source locations and HMR staleness; HTTP and stdio debug MCP server (`raiton-debug`) with scopes, audit and conformance; enriched, actionable errors; route examples and error documentation in the manifest and OpenAPI; opt-in configuration, local-only defaults and constant-time token protection.

## [6.10.0-beta.28](https://github.com/protorians/raiton/compare/v6.8.9-beta.25...v6.10.0-beta.28) (2026-11-27)

### Features

* feat: contrats, manifeste, MCP, observabilité, CLI et optimisation des performances (#21) ([2131645](https://github.com/protorians/raiton/commit/2131645c5c4f1d32a762c811d444e1d8fabb2833))

### Bug Fixes

* chore(gitignore): ancrer l'ignore des specs à la racine du dépôt ([41cc1d8](https://github.com/protorians/raiton/commit/41cc1d871c01c65b9c17b0b52a38f2b88b4db0fb))

## [6.9.1-beta.27](https://github.com/protorians/raiton/compare/v6.9.0-beta.26...v6.9.1-beta.27) (2026-11-27)

### Bug Fixes

* chore(ci): calibre les budgets de benchmark sur les runners partagés ([1f5586d](https://github.com/protorians/raiton/commit/1f5586d98bc7b04e29755090a2009dd3f645945b))
* perf(framework): accélère le routage, le pipeline HTTP et le démarrage ([25e9dfb](https://github.com/protorians/raiton/commit/25e9dfbe4dac7dd0983340e530d87061ded2f335))

### Other Changes

* test(perf): ajoute les benchmarks et les tests de non-régression ([4c28bbf](https://github.com/protorians/raiton/commit/4c28bbf857068271ec444c5fdfc2bea7b5148343))

## [6.9.0-beta.26](https://github.com/protorians/raiton/compare/v6.8.9-beta.25...v6.9.0-beta.26) (2026-11-27)

### Features

* **config**: `.ts`/`.mts`/`.cts` loading first, field-level validation, published JSON Schema and generated declarations for the package `types` entry. ([5c60a27](https://github.com/protorians/raiton/commit/5c60a27786751af16e17d4bedded54f6f10dc497))
* **contracts**: schema-first `raiton/contracts` (TypeBox) feeding runtime validation, types, OpenAPI and the generated client; `@Input`/`@Output`; stable `VALIDATION_ERROR` payloads; development-only output validation. ([e22328e](https://github.com/protorians/raiton/commit/e22328ed35ca74dfb575c6a05797f4852dc952eb))
* **manifest**: versioned project inventory (routes, artifacts, DI graph, config, env, MCP tools, source locations), published JSON Schema and HMR cache invalidation. ([efb8550](https://github.com/protorians/raiton/commit/efb85501382237dfcbb5b9a38f5e58816f982e7f))
* **mcp**: stdio transport, shared HTTP/stdio conformance suite, input/output schemas, safety annotations, default-deny destructive tools, scopes, audit with secret redaction and rate limiting. ([ce68d66](https://github.com/protorians/raiton/commit/ce68d669c38f64fe8a3189649d0792db560c7af2))
* **observability**: correlation ids, Prometheus metrics, OTLP traces, stable error catalogue, readiness and bounded graceful shutdown. ([899fed9](https://github.com/protorians/raiton/commit/899fed91afed36f663aa6d68e0c4b1528c8ee484))
* **discoverability**: development page (`/__dev`), route suggestions on 404, default Redoc OpenAPI UI. ([899fed9](https://github.com/protorians/raiton/commit/899fed91afed36f663aa6d68e0c4b1528c8ee484))
* **cli**: `new`, `generate`, `routes`, `inspect`, `why`, `doctor`, `openapi export`, `client`, `contract check|snapshot`, `mcp list|inspect|test|serve|conformance`, `docs agents` with JSON output, stable exit codes and dry-run. ([7390572](https://github.com/protorians/raiton/commit/73905720187e251fc0b39b93bcf60d8961650112))
* **docs**: French/English guides, executable recipes, `llms.txt`, `llms-full.txt`, `AGENTS.md`, `CLAUDE.md` and generated references. ([030e996](https://github.com/protorians/raiton/commit/030e99668c18b3f78bc66bb3c103bf6d4ac4c7c3))

### Bug Fixes

* `Application.handle` now honours `statusCode` carried by plain response objects (health checks).
* OpenAPI UI no longer sends an empty body; a default UI is provided.
* The project bootstrapper no longer installs the body parser twice or starts the scheduler outside serving mode.

### Build

* Publish generated type declarations and update scripts, npm ignores and the CI workflow. ([3d8ec11](https://github.com/protorians/raiton/commit/3d8ec11ece759ceca5f26abc168e72f07ec485f1))

## [6.8.9-beta.25](https://github.com/protorians/raiton/compare/v6.8.8-beta.24...v6.8.9-beta.25) (2026-11-26)

### Bug Fixes

* fix(framework): sécurise le rechargement HMR des middlewares et hooks ([08bb7ef](https://github.com/protorians/raiton/commit/08bb7efb2665dce0af607694fffdbd691751d1aa))

## [6.8.8-beta.24](https://github.com/protorians/raiton/compare/v6.8.7-beta.22...v6.8.8-beta.24) (2026-10-30)

### Bug Fixes

* fix:version ([66e4a81](https://github.com/protorians/raiton/commit/66e4a81d212a72fbcc947775d97ef20f09ac5989))

## [6.8.7-beta.22](https://github.com/protorians/raiton/compare/v6.8.6-beta.21...v6.8.7-beta.22) (2026-10-30)

### Bug Fixes

* chore(test): ajoute le script test (bun test) ([4b25595](https://github.com/protorians/raiton/commit/4b2559542894fed96ba6deef38427f197d3e5da9))
* fix(core): retrouve l'artefact décoré parmi les exports nommés ([3f60b91](https://github.com/protorians/raiton/commit/3f60b914851cd920b96376d04be3efde9f968a95))

## [6.8.6-beta.21](https://github.com/protorians/raiton/compare/v6.8.3-beta.19...v6.8.6-beta.21) (2026-10-22)

### Bug Fixes

* fix:version ([3d9f1bf](https://github.com/protorians/raiton/commit/3d9f1bf1f64e58e729aa92696bc7a3868c621fdd))
* chore(release): v6.8.4-beta.20 [skip ci] ([3c6074e](https://github.com/protorians/raiton/commit/3c6074e47a6d399f67eebc624fc13275f88b5403))
* fix(framework): détecte la véritable adresse LAN du serveur ([c5583a6](https://github.com/protorians/raiton/commit/c5583a6b5083280a9c5fe9fa015286c7085a9453))

## [6.8.4-beta.20](https://github.com/protorians/raiton/compare/v6.8.3-beta.19...v6.8.4-beta.20) (2026-10-22)

### Bug Fixes

* fix(framework): détecte la véritable adresse LAN du serveur ([c5583a6](https://github.com/protorians/raiton/commit/c5583a6b5083280a9c5fe9fa015286c7085a9453))

## [6.8.3-beta.19](https://github.com/protorians/raiton/compare/v6.8.2-beta.18...v6.8.3-beta.19) (2026-10-10)

### Bug Fixes

* fix(framework): DataTransferObject tolère un corps absent ([13926ab](https://github.com/protorians/raiton/commit/13926ab9f45aaa56a27b46ffc1e923a2876f6ad1))

## [6.8.2-beta.18](https://github.com/protorians/raiton/compare/v6.8.1-beta.17...v6.8.2-beta.18) (2026-10-08)

### Bug Fixes

* chore(package): update @types/bun to 1.4.2 and typescript to 7.0.2 ([b32054d](https://github.com/protorians/raiton/commit/b32054da6ece5866315abb896404d2cee5b80947))

## [6.8.1-beta.17](https://github.com/protorians/raiton/compare/v6.7.0-beta.15...v6.8.1-beta.17) (2026-09-26)

### Bug Fixes

* fix(package): remove period from description in package.json ([894ee9b](https://github.com/protorians/raiton/commit/894ee9b6471392d9743c030e7cd176c64dff3071))

### Other Changes

* Add task scheduler and improve dependency injection logging (#20) ([05cd0c9](https://github.com/protorians/raiton/commit/05cd0c9774d242ee24697b14e9ea52b94cbbb663))

## [6.8.0-beta.16](https://github.com/protorians/raiton/compare/v6.7.0-beta.15...v6.8.0-beta.16) (2026-09-26)

### Features

* feat(scheduler): add task scheduler with decorators, queue backends, and HMR support ([63069d6](https://github.com/protorians/raiton/commit/63069d696f122e8def2a041718467848644e3e62))

### Bug Fixes

* refactor(injection): log a trace when a dependency is not registered ([567d5b4](https://github.com/protorians/raiton/commit/567d5b4e29b9e3d8e45a1a16d378a0881e4df599))

## [6.7.0-beta.15](https://github.com/protorians/raiton/compare/v6.6.0-beta.14...v6.7.0-beta.15) (2026-09-09)

### Features

* feat: add HTTP cache system with `@Cache()` decorator, `CacheManager`, and ETag support (#19) ([3cbafa5](https://github.com/protorians/raiton/commit/3cbafa5d38ba4db223f17664726b28790ad15c5a))

### Other Changes

* Merge pull request #18 ([0bab971](https://github.com/protorians/raiton/commit/0bab971d90cb6a329859c8d24929c67a3a2d9518))

## [6.6.0-beta.14](https://github.com/protorians/raiton/compare/v6.5.0-beta.13...v6.6.0-beta.14) (2026-09-04)

### Features

* feat: add DI artifact loading with artifact classification and timestamp-based caching ([fa30f50](https://github.com/protorians/raiton/commit/fa30f501a49161559faea0ca594de56edba45916))
* feat: add health-check support with default endpoint, decorator, and customizable configurations (#17) ([c6ca71d](https://github.com/protorians/raiton/commit/c6ca71dc62c99ce5ee0ec77de3bada333fcddfe6))
* feat: Add CSRF protection middleware and improve related utilities (#16) ([de401f4](https://github.com/protorians/raiton/commit/de401f49a71af4088426990007934fa354ad0549))
* feat: add DI artifact loading with artifact classification and timestamp-based caching ([eed2a57](https://github.com/protorians/raiton/commit/eed2a5798d1b692718a5fc1d28ab34a408012a59))
* feat: add health-check support with default endpoint, decorator, and customizable configurations (#17) ([69c6a62](https://github.com/protorians/raiton/commit/69c6a62106d9eaf47eae2637a3816082fa7efdd9))

### Bug Fixes

* chore(workflows): allow non-conventional commits in publish step ([792adff](https://github.com/protorians/raiton/commit/792adff7555042da6a427bd57e2410df8f8c300d))
* docs(user-guide): recommend import type for type-only symbols ([6d2655b](https://github.com/protorians/raiton/commit/6d2655b8f682b48b1a846f63ba764bb27e3e9629))
* docs(user-guide): recommend import type for type-only symbols ([98afa0f](https://github.com/protorians/raiton/commit/98afa0f6f62db8fecdb0fe62b1463f47d8777618))

### Other Changes

* Merge remote-tracking branch 'origin/beta' into beta ([d312e8a](https://github.com/protorians/raiton/commit/d312e8ad801ebf0a14687e28b80d5f022c1e543f))
* Add CSRF protection middleware and improve related utilities (#16) ([ba48340](https://github.com/protorians/raiton/commit/ba4834036ef0a4e363d36135dbba82b12b3638b7))

## [6.5.0-beta.13](https://github.com/protorians/raiton/compare/v6.4.0-beta.12...v6.5.0-beta.13) (2026-09-03)

### Features

* feat: integrate MCP (Model Context Protocol) support, including server registration, routing, OpenAPI documentation, and artifact handling ([436464c](https://github.com/protorians/raiton/commit/436464c166b8123a291b868e48b711866f09bc8b))

## [6.4.0-beta.12](https://github.com/protorians/raiton/compare/v6.3.1-beta.11...v6.4.0-beta.12) (2026-09-02)

### Features

* feat: add HTTPS configuration with certificate management, auto-generation, and runtime support ([0e9aacb](https://github.com/protorians/raiton/commit/0e9aacb74a37db61a3b57dcf0a12cf64f8ae61cb))

### Bug Fixes

* refactor: improve HTTPS certificate generation and refine routing configuration handling ([8206e6f](https://github.com/protorians/raiton/commit/8206e6f2e98208c49d0ecdb55bb06d93d623191f))
* refactor: include `mcp` in artifact registration list ([7ccc5b9](https://github.com/protorians/raiton/commit/7ccc5b9d8fa3d01ec0ee2d3a86c5f985e5ca752f))

## [6.3.1-beta.11](https://github.com/protorians/raiton/compare/v6.3.0-beta.10...v6.3.1-beta.11) (2026-08-30)

### Bug Fixes

* refactor: improve `env` function type handling and ensure consistent value parsing ([f855d1e](https://github.com/protorians/raiton/commit/f855d1effc6c8c81beef73dbbaccbcbe7bcc9cc1))

## [6.3.0-beta.10](https://github.com/protorians/raiton/compare/v6.1.1-beta.5...v6.3.0-beta.10) (2026-08-29)

### Features

* feat: add postinstall script for Windows compatibility and bin file permissions setup ([8a819e4](https://github.com/protorians/raiton/commit/8a819e44d71e0208b00457264e668fc4570cd573))

### Bug Fixes

* refactor: enhance version updater with tag synchronization, changelog generation, and improved commit handling ([6000800](https://github.com/protorians/raiton/commit/600080096ed1fe8ce07e5acd605bff5af849eee7))
* refactor: optimize route matching to prioritize matches with fewer parameters ([add1559](https://github.com/protorians/raiton/commit/add1559589501db8e2e665677524993aede93d55))
* fix: correct path resolution in postinstall script ([52b6c67](https://github.com/protorians/raiton/commit/52b6c67770d9be81eea1f13cffc1c6dfdea4a582))
* refactor: migrate postinstall script to TypeScript and update package.json accordingly ([041d041](https://github.com/protorians/raiton/commit/041d041b0a062aebd6acf5de0918045b4f8453ec))
* refactor: clean up version updater with consistent formatting, minor readability improvements, and extended type handling ([4789d8b](https://github.com/protorians/raiton/commit/4789d8b5d65da0638f5f63162294c3a573c90bc9))
* refactor: update injection container logging to use `Logger.info` for clear operation messaging ([a656751](https://github.com/protorians/raiton/commit/a65675180e58d6bd90413c61268099dac887de8d))
* refactor: improve version updater with upstream branch detection, enhanced commit range parsing, and base overrides for CI usage ([dc264e7](https://github.com/protorians/raiton/commit/dc264e74d65bb6007891734dd71a0a35282ef59e))
* refactor: improve version updater with upstream branch detection, enhanced commit range parsing, and base overrides for CI usage ([1ac6eee](https://github.com/protorians/raiton/commit/1ac6eeee8b8bfe6b12b685a1fd51a392bc73a15d))
* refactor: enhance version updater with validation, logging improvements, and support for non-conventional commits ([e8b3b86](https://github.com/protorians/raiton/commit/e8b3b86540663117f1c0e770593f7563cd18661c))
* refactor: overhaul version updater to support pre-releases, conventional commits, and enhanced CLI functionality ([b9e8d28](https://github.com/protorians/raiton/commit/b9e8d281387670ff19474b55d073708595cd201e))

### Other Changes

* release: downgrade version to 6.2.2-beta.9 ([2ffca7b](https://github.com/protorians/raiton/commit/2ffca7b081106ad1b284c222e3e8419345b3704e))
* release: bump version to 6.1.3-beta.7 ([bc82e15](https://github.com/protorians/raiton/commit/bc82e15fece69bf3074d9e1831651801bf458b12))

# [1.0.0-alpha.4](https://github.com/protorians/raiton/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2026-02-17)

## Breaking Changes
### Bug Fixes

* remove emojis from README section titles for consistency ([8d604ee](https://github.com/protorians/raiton/commit/8d604eec0825bfdf172988ee9fe662076b7e46be))
* remove unused Fastify dependencies and deprecate parameter handling utilities ([282db2c](https://github.com/protorians/raiton/commit/282db2cb4baeb52b816e1444f9d618570a073443))
* update `.releaserc.json` to refine branch configurations and format `assets` array ([0f803c0](https://github.com/protorians/raiton/commit/0f803c08d03549bd28ef9e61fe9c6c121d2f781d))
* update keywords in `package.json` and reset version to `0.0.0` ([44f7c85](https://github.com/protorians/raiton/commit/44f7c858330fc5455260d66d05b78a5a33d388f8))


### Features

* add `NODE_AUTH_TOKEN` to `publish.yml` for semantic-release environment setup ([44a561b](https://github.com/protorians/raiton/commit/44a561b60bc3f35ae59bb404c343ef56baab4d26))
* enable provenance support in `package.json` and `.releaserc.json` ([b5db171](https://github.com/protorians/raiton/commit/b5db171a84150aefc2978b37c5d3544b5769b160))
* make package public and fix `publish.yml` token variable ([0293ee6](https://github.com/protorians/raiton/commit/0293ee629e444be0d90823896ea57212743d357d))
* remove redundant comments from `publish.yml` workflow ([37ddce9](https://github.com/protorians/raiton/commit/37ddce94356dba8f2c2d5e87af7fc3ade4ca3cf5))

# [1.0.0-alpha.3](https://github.com/protorians/raiton/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2026-02-17)


### Bug Fixes

* extend `ChildProcess` types to include `ChildProcessWithoutNullStreams` and adjust `Logger` for optional child process PID ([e1e7e17](https://github.com/protorians/raiton/commit/e1e7e17ddd921da5f09cf3240f06a64fddd274f5))
* refactor runtime detection in `CliTools` and streamline imports in bin files ([b431aa3](https://github.com/protorians/raiton/commit/b431aa31d86e2ef480fbafa8a2cfbb5ae6a4c640))
* remove unused HMR and artifact modules, refactor thread lifecycle, and optimize artifact initialization in application core ([af88e34](https://github.com/protorians/raiton/commit/af88e341ba8c695b3a9817d450845e25bb004b9e))
* remove unused SDK modules, rework artifacts handling, and enhance parametrable decorators ([ddc6d35](https://github.com/protorians/raiton/commit/ddc6d35cd070e25f0da19185e776feead0843ad0))
* remove unused types, streamline imports, and enhance type definitions with Lifecycle interfaces ([5ef2e46](https://github.com/protorians/raiton/commit/5ef2e46ecec191c1e51d79c997ebe2f8244dc7fc))


### Features

* add `class-validator` dependency and update README to remove Deno beta references ([a616086](https://github.com/protorians/raiton/commit/a616086652d437d0763d7c8313150c56ee4d11d9))
* add basic `deno.json` with imports and tasks configuration ([e31b024](https://github.com/protorians/raiton/commit/e31b02414bc4378a7125678fe88268f57367c646))
* add global runtime detection constants for Bun and Deno in `constants.ts` ([c63ac8e](https://github.com/protorians/raiton/commit/c63ac8e36089e58856c180706c89b51390ae850f))
* introduce HTTP response handling modules with enums, exceptions, and utilities for streamlined error management and parameterized responses ([e1c5fa3](https://github.com/protorians/raiton/commit/e1c5fa3cc00fd7e7ce61ac44243483c2127f1dfe))

# [1.0.0-alpha.2](https://github.com/protorians/raiton/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2026-02-16)


### Bug Fixes

* `CliTools`: add support for Deno runtime, improve runtime detection, and adjust spawn logic for `.ts` file handling ([71c506a](https://github.com/protorians/raiton/commit/71c506afcbb4ec3acffec8d4b36934afa8d0b6b3))

# 1.0.0-alpha.1 (2026-02-16)


### Bug Fixes

* Add `pnpm-lock.yaml` for dependency management ([86dab7e](https://github.com/protorians/raiton/commit/86dab7ee712bcf72024687f59ada9974af9bdbe4))
* lazy-initialize `_container` in `GraftsRegistry` to optimize resource usage ([2847249](https://github.com/protorians/raiton/commit/2847249a70e08957ae618421bab11e68d126f057))
* update log method in `BuildCommand`, add `LBadge` for improved log formatting ([63d1126](https://github.com/protorians/raiton/commit/63d11265a65af60e47e07053376c87dd541a5fbb))


### Features

* add `IGlobalGrafts` interface definition ([72585ed](https://github.com/protorians/raiton/commit/72585ed24c3c1b4e84626fca92ad9d9303a33061))
* add CLI commands and bootstrap logic for the `Raiton` framework ([61d6565](https://github.com/protorians/raiton/commit/61d6565e6b6f4f2eaeaf65e2878c0f24936bfd68))
* add constants for framework modularization ([98bae11](https://github.com/protorians/raiton/commit/98bae1177e2b458a1e1925e151f1844db50b78c5))
* add enums for framework modularization ([087864f](https://github.com/protorians/raiton/commit/087864f89f8a5d87746f5595ca3c148145473044))
* add process event handling and environment configuration setup ([93fc142](https://github.com/protorians/raiton/commit/93fc142bde480cd166e1f2681644768692fcecf7))
* add Swagger HTML page plugin for API documentation ([d287757](https://github.com/protorians/raiton/commit/d2877576d7a310ba814aa7c4b7790271582a20bf))
* add type definitions for core application structures ([c756482](https://github.com/protorians/raiton/commit/c75648245c7f7e2f2d25350c04e2dc0e4f5e3109))
* add utility functions for framework ([b947207](https://github.com/protorians/raiton/commit/b947207afe37e9a876fe6f86facc081ce4fbb0de))
* implement core modules for `Raiton` framework ([89c1288](https://github.com/protorians/raiton/commit/89c12886a300015da603cda57f9dbbcd5394962a))
* implement framework core modules and utilities ([085da37](https://github.com/protorians/raiton/commit/085da37d03399f1732d463763302d67df85848b1))
* integrate `bodyParserPlugin` into application setup, refine `ControllerMeta` structure, and clean up router handler logging ([3dc29b9](https://github.com/protorians/raiton/commit/3dc29b9d203fd1d56cd22de65f58dc6c9353566a))
* introduce decorators for framework modularization ([e90e5fb](https://github.com/protorians/raiton/commit/e90e5fb017325115594985844328ac4d0542ccc5))

## [0.0.2](https://github.com/protorians/raiton/compare/v0.0.1...v0.0.2) (2025-12-30)


### Bug Fixes

* update `.releaserc.json` to refine branch configurations and format `assets` array ([0f803c0](https://github.com/protorians/raiton/commit/0f803c08d03549bd28ef9e61fe9c6c121d2f781d))

# 1.0.0 (2025-12-30)


### Bug Fixes

* remove unused Fastify dependencies and deprecate parameter handling utilities ([282db2c](https://github.com/protorians/raiton/commit/282db2cb4baeb52b816e1444f9d618570a073443))
* update keywords in `package.json` and reset version to `0.0.0` ([44f7c85](https://github.com/protorians/raiton/commit/44f7c858330fc5455260d66d05b78a5a33d388f8))


### Features

* add `NODE_AUTH_TOKEN` to `publish.yml` for semantic-release environment setup ([44a561b](https://github.com/protorians/raiton/commit/44a561b60bc3f35ae59bb404c343ef56baab4d26))
* enable provenance support in `package.json` and `.releaserc.json` ([b5db171](https://github.com/protorians/raiton/commit/b5db171a84150aefc2978b37c5d3544b5769b160))
* make package public and fix `publish.yml` token variable ([0293ee6](https://github.com/protorians/raiton/commit/0293ee629e444be0d90823896ea57212743d357d))
* remove redundant comments from `publish.yml` workflow ([37ddce9](https://github.com/protorians/raiton/commit/37ddce94356dba8f2c2d5e87af7fc3ade4ca3cf5))

## [1.1.1](https://github.com/protorians/raiton/compare/v1.1.0...v1.1.1) (2025-12-30)


### Bug Fixes

* remove unused Fastify dependencies and deprecate parameter handling utilities ([282db2c](https://github.com/protorians/raiton/commit/282db2cb4baeb52b816e1444f9d618570a073443))

# [1.1.0](https://github.com/protorians/raiton/compare/v1.0.0...v1.1.0) (2025-12-30)


### Features

* enable provenance support in `package.json` and `.releaserc.json` ([b5db171](https://github.com/protorians/raiton/commit/b5db171a84150aefc2978b37c5d3544b5769b160))

# 1.0.0 (2025-12-30)


### Features

* add `NODE_AUTH_TOKEN` to `publish.yml` for semantic-release environment setup ([44a561b](https://github.com/protorians/raiton/commit/44a561b60bc3f35ae59bb404c343ef56baab4d26))
* make package public and fix `publish.yml` token variable ([0293ee6](https://github.com/protorians/raiton/commit/0293ee629e444be0d90823896ea57212743d357d))
* remove redundant comments from `publish.yml` workflow ([37ddce9](https://github.com/protorians/raiton/commit/37ddce94356dba8f2c2d5e87af7fc3ade4ca3cf5))

# 1.0.0-beta.1 (2025-12-30)


### Bug Fixes

* Add `pnpm-lock.yaml` for dependency management ([86dab7e](https://github.com/protorians/raiton/commit/86dab7ee712bcf72024687f59ada9974af9bdbe4))
* lazy-initialize `_container` in `GraftsRegistry` to optimize resource usage ([2847249](https://github.com/protorians/raiton/commit/2847249a70e08957ae618421bab11e68d126f057))
* update log method in `BuildCommand`, add `LBadge` for improved log formatting ([63d1126](https://github.com/protorians/raiton/commit/63d11265a65af60e47e07053376c87dd541a5fbb))


### Features

* add `IGlobalGrafts` interface definition ([72585ed](https://github.com/protorians/raiton/commit/72585ed24c3c1b4e84626fca92ad9d9303a33061))
* add CLI commands and bootstrap logic for the `Raiton` framework ([61d6565](https://github.com/protorians/raiton/commit/61d6565e6b6f4f2eaeaf65e2878c0f24936bfd68))
* add constants for framework modularization ([98bae11](https://github.com/protorians/raiton/commit/98bae1177e2b458a1e1925e151f1844db50b78c5))
* add enums for framework modularization ([087864f](https://github.com/protorians/raiton/commit/087864f89f8a5d87746f5595ca3c148145473044))
* add process event handling and environment configuration setup ([93fc142](https://github.com/protorians/raiton/commit/93fc142bde480cd166e1f2681644768692fcecf7))
* add Swagger HTML page plugin for API documentation ([d287757](https://github.com/protorians/raiton/commit/d2877576d7a310ba814aa7c4b7790271582a20bf))
* add type definitions for core application structures ([c756482](https://github.com/protorians/raiton/commit/c75648245c7f7e2f2d25350c04e2dc0e4f5e3109))
* add utility functions for framework ([b947207](https://github.com/protorians/raiton/commit/b947207afe37e9a876fe6f86facc081ce4fbb0de))
* implement core modules for `Raiton` framework ([89c1288](https://github.com/protorians/raiton/commit/89c12886a300015da603cda57f9dbbcd5394962a))
* implement framework core modules and utilities ([085da37](https://github.com/protorians/raiton/commit/085da37d03399f1732d463763302d67df85848b1))
* integrate `bodyParserPlugin` into application setup, refine `ControllerMeta` structure, and clean up router handler logging ([3dc29b9](https://github.com/protorians/raiton/commit/3dc29b9d203fd1d56cd22de65f58dc6c9353566a))
* introduce decorators for framework modularization ([e90e5fb](https://github.com/protorians/raiton/commit/e90e5fb017325115594985844328ac4d0542ccc5))

# [1.0.0-alpha.4](https://github.com/protorians/raiton/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2025-12-30)


### Bug Fixes

* update log method in `BuildCommand`, add `LBadge` for improved log formatting ([63d1126](https://github.com/protorians/raiton/commit/63d11265a65af60e47e07053376c87dd541a5fbb))


### Features

* integrate `bodyParserPlugin` into application setup, refine `ControllerMeta` structure, and clean up router handler logging ([3dc29b9](https://github.com/protorians/raiton/commit/3dc29b9d203fd1d56cd22de65f58dc6c9353566a))

# [1.0.0-alpha.3](https://github.com/protorians/raiton/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2025-12-23)


### Bug Fixes

* lazy-initialize `_container` in `GraftsRegistry` to optimize resource usage ([2847249](https://github.com/protorians/raiton/commit/2847249a70e08957ae618421bab11e68d126f057))

# [1.0.0-alpha.2](https://github.com/protorians/raiton/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2025-12-22)


### Features

* add `IGlobalGrafts` interface definition ([72585ed](https://github.com/protorians/raiton/commit/72585ed24c3c1b4e84626fca92ad9d9303a33061))
* add CLI commands and bootstrap logic for the `Raiton` framework ([61d6565](https://github.com/protorians/raiton/commit/61d6565e6b6f4f2eaeaf65e2878c0f24936bfd68))
* add constants for framework modularization ([98bae11](https://github.com/protorians/raiton/commit/98bae1177e2b458a1e1925e151f1844db50b78c5))
* add enums for framework modularization ([087864f](https://github.com/protorians/raiton/commit/087864f89f8a5d87746f5595ca3c148145473044))
* add process event handling and environment configuration setup ([93fc142](https://github.com/protorians/raiton/commit/93fc142bde480cd166e1f2681644768692fcecf7))
* add Swagger HTML page plugin for API documentation ([d287757](https://github.com/protorians/raiton/commit/d2877576d7a310ba814aa7c4b7790271582a20bf))
* add type definitions for core application structures ([c756482](https://github.com/protorians/raiton/commit/c75648245c7f7e2f2d25350c04e2dc0e4f5e3109))
* add utility functions for framework ([b947207](https://github.com/protorians/raiton/commit/b947207afe37e9a876fe6f86facc081ce4fbb0de))
* implement core modules for `Raiton` framework ([89c1288](https://github.com/protorians/raiton/commit/89c12886a300015da603cda57f9dbbcd5394962a))
* implement framework core modules and utilities ([085da37](https://github.com/protorians/raiton/commit/085da37d03399f1732d463763302d67df85848b1))
* introduce decorators for framework modularization ([e90e5fb](https://github.com/protorians/raiton/commit/e90e5fb017325115594985844328ac4d0542ccc5))

# 1.0.0-alpha.1 (2025-12-04)


### Bug Fixes

* Add `pnpm-lock.yaml` for dependency management ([86dab7e](https://github.com/protorians/sentient-cli/commit/86dab7ee712bcf72024687f59ada9974af9bdbe4))
