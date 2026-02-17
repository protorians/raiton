# 1.0.0-beta.1 (2026-02-17)


### Bug Fixes

* Add `pnpm-lock.yaml` for dependency management ([86dab7e](https://github.com/protorians/raiton/commit/86dab7ee712bcf72024687f59ada9974af9bdbe4))
* lazy-initialize `_container` in `GraftsRegistry` to optimize resource usage ([2847249](https://github.com/protorians/raiton/commit/2847249a70e08957ae618421bab11e68d126f057))
* update log method in `BuildCommand`, add `LBadge` for improved log formatting ([63d1126](https://github.com/protorians/raiton/commit/63d11265a65af60e47e07053376c87dd541a5fbb))


### Features

* add `IGlobalGrafts` interface definition ([72585ed](https://github.com/protorians/raiton/commit/72585ed24c3c1b4e84626fca92ad9d9303a33061))
* add CLI commands and bootstrap logic for the `Raiton` framework ([61d6565](https://github.com/protorians/raiton/commit/61d6565e6b6f4f2eaeaf65e2878c0f24936bfd68))
* add constants for SDK modularization ([98bae11](https://github.com/protorians/raiton/commit/98bae1177e2b458a1e1925e151f1844db50b78c5))
* add enums for SDK modularization ([087864f](https://github.com/protorians/raiton/commit/087864f89f8a5d87746f5595ca3c148145473044))
* add process event handling and environment configuration setup ([93fc142](https://github.com/protorians/raiton/commit/93fc142bde480cd166e1f2681644768692fcecf7))
* add Swagger HTML page plugin for API documentation ([d287757](https://github.com/protorians/raiton/commit/d2877576d7a310ba814aa7c4b7790271582a20bf))
* add type definitions for core application structures ([c756482](https://github.com/protorians/raiton/commit/c75648245c7f7e2f2d25350c04e2dc0e4f5e3109))
* add utility functions for SDK ([b947207](https://github.com/protorians/raiton/commit/b947207afe37e9a876fe6f86facc081ce4fbb0de))
* implement core modules for `Raiton` framework ([89c1288](https://github.com/protorians/raiton/commit/89c12886a300015da603cda57f9dbbcd5394962a))
* implement SDK core modules and utilities ([085da37](https://github.com/protorians/raiton/commit/085da37d03399f1732d463763302d67df85848b1))
* integrate `bodyParserPlugin` into application setup, refine `ControllerMeta` structure, and clean up router handler logging ([3dc29b9](https://github.com/protorians/raiton/commit/3dc29b9d203fd1d56cd22de65f58dc6c9353566a))
* introduce decorators for SDK modularization ([e90e5fb](https://github.com/protorians/raiton/commit/e90e5fb017325115594985844328ac4d0542ccc5))

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

# [1.0.0-alpha.3](https://github.com/protorians/raiton/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2026-02-17)

### Features

* **core:** intégration de `class-validator` pour la validation automatique via les DTO ([a616086](https://github.com/protorians/raiton/commit/a616086))
* **core:** refonte complète de l'injection de dépendances avec gestion des cycles de vie `onInit`, `onMount`, `onUnmount` ([e90e5fb](https://github.com/protorians/raiton/commit/e90e5fb))
* **core:** introduction de la gestion des exceptions HTTP et des réponses paramétrables ([e1c5fa3](https://github.com/protorians/raiton/commit/e1c5fa3))
* **cli:** détection améliorée du runtime et support initial de Deno via `deno.json` ([e31b024](https://github.com/protorians/raiton/commit/e31b024))
* **ci:** passage à Bun pour les workflows de build et de release

### Bug Fixes

* **core:** correction de la détection du runtime dans `CliTools` ([b431aa3](https://github.com/protorians/raiton/commit/b431aa3))
* **core:** suppression des modules HMR et artifacts inutilisés pour alléger le noyau ([af88e34](https://github.com/protorians/raiton/commit/af88e34))

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
* add constants for SDK modularization ([98bae11](https://github.com/protorians/raiton/commit/98bae1177e2b458a1e1925e151f1844db50b78c5))
* add enums for SDK modularization ([087864f](https://github.com/protorians/raiton/commit/087864f89f8a5d87746f5595ca3c148145473044))
* add process event handling and environment configuration setup ([93fc142](https://github.com/protorians/raiton/commit/93fc142bde480cd166e1f2681644768692fcecf7))
* add Swagger HTML page plugin for API documentation ([d287757](https://github.com/protorians/raiton/commit/d2877576d7a310ba814aa7c4b7790271582a20bf))
* add type definitions for core application structures ([c756482](https://github.com/protorians/raiton/commit/c75648245c7f7e2f2d25350c04e2dc0e4f5e3109))
* add utility functions for SDK ([b947207](https://github.com/protorians/raiton/commit/b947207afe37e9a876fe6f86facc081ce4fbb0de))
* implement core modules for `Raiton` framework ([89c1288](https://github.com/protorians/raiton/commit/89c12886a300015da603cda57f9dbbcd5394962a))
* implement SDK core modules and utilities ([085da37](https://github.com/protorians/raiton/commit/085da37d03399f1732d463763302d67df85848b1))
* integrate `bodyParserPlugin` into application setup, refine `ControllerMeta` structure, and clean up router handler logging ([3dc29b9](https://github.com/protorians/raiton/commit/3dc29b9d203fd1d56cd22de65f58dc6c9353566a))
* introduce decorators for SDK modularization ([e90e5fb](https://github.com/protorians/raiton/commit/e90e5fb017325115594985844328ac4d0542ccc5))

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
* add constants for SDK modularization ([98bae11](https://github.com/protorians/raiton/commit/98bae1177e2b458a1e1925e151f1844db50b78c5))
* add enums for SDK modularization ([087864f](https://github.com/protorians/raiton/commit/087864f89f8a5d87746f5595ca3c148145473044))
* add process event handling and environment configuration setup ([93fc142](https://github.com/protorians/raiton/commit/93fc142bde480cd166e1f2681644768692fcecf7))
* add Swagger HTML page plugin for API documentation ([d287757](https://github.com/protorians/raiton/commit/d2877576d7a310ba814aa7c4b7790271582a20bf))
* add type definitions for core application structures ([c756482](https://github.com/protorians/raiton/commit/c75648245c7f7e2f2d25350c04e2dc0e4f5e3109))
* add utility functions for SDK ([b947207](https://github.com/protorians/raiton/commit/b947207afe37e9a876fe6f86facc081ce4fbb0de))
* implement core modules for `Raiton` framework ([89c1288](https://github.com/protorians/raiton/commit/89c12886a300015da603cda57f9dbbcd5394962a))
* implement SDK core modules and utilities ([085da37](https://github.com/protorians/raiton/commit/085da37d03399f1732d463763302d67df85848b1))
* integrate `bodyParserPlugin` into application setup, refine `ControllerMeta` structure, and clean up router handler logging ([3dc29b9](https://github.com/protorians/raiton/commit/3dc29b9d203fd1d56cd22de65f58dc6c9353566a))
* introduce decorators for SDK modularization ([e90e5fb](https://github.com/protorians/raiton/commit/e90e5fb017325115594985844328ac4d0542ccc5))

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
* add constants for SDK modularization ([98bae11](https://github.com/protorians/raiton/commit/98bae1177e2b458a1e1925e151f1844db50b78c5))
* add enums for SDK modularization ([087864f](https://github.com/protorians/raiton/commit/087864f89f8a5d87746f5595ca3c148145473044))
* add process event handling and environment configuration setup ([93fc142](https://github.com/protorians/raiton/commit/93fc142bde480cd166e1f2681644768692fcecf7))
* add Swagger HTML page plugin for API documentation ([d287757](https://github.com/protorians/raiton/commit/d2877576d7a310ba814aa7c4b7790271582a20bf))
* add type definitions for core application structures ([c756482](https://github.com/protorians/raiton/commit/c75648245c7f7e2f2d25350c04e2dc0e4f5e3109))
* add utility functions for SDK ([b947207](https://github.com/protorians/raiton/commit/b947207afe37e9a876fe6f86facc081ce4fbb0de))
* implement core modules for `Raiton` framework ([89c1288](https://github.com/protorians/raiton/commit/89c12886a300015da603cda57f9dbbcd5394962a))
* implement SDK core modules and utilities ([085da37](https://github.com/protorians/raiton/commit/085da37d03399f1732d463763302d67df85848b1))
* introduce decorators for SDK modularization ([e90e5fb](https://github.com/protorians/raiton/commit/e90e5fb017325115594985844328ac4d0542ccc5))

# 1.0.0-alpha.1 (2025-12-04)


### Bug Fixes

* Add `pnpm-lock.yaml` for dependency management ([86dab7e](https://github.com/protorians/sentient-cli/commit/86dab7ee712bcf72024687f59ada9974af9bdbe4))
