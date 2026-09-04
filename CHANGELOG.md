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
