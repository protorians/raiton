# Module Framework (`source/framework/`)

Le framework fournit les décorateurs, le runtime, les plugins intégrés, les réponses, les exceptions, les enums et les classes de base.

> **Navigation :** [← docs/](../README.md) | [↑ Index](../README.md) | [runtime.md →](runtime.md)

## Table des matières

| Fichier | Description |
|---------|-------------|
| [runtime.md](runtime.md) | Adaptateurs runtime (Bun, Node.js, Deno) |
| [responses.md](responses.md) | Réponses HTTP et exceptions |
| [encryption.md](encryption.md) | Hachage et chiffrement |
| [env.md](env.md) | Variables d'environnement typées |
| [base-classes.md](base-classes.md) | DTO, ViewModel, Service, Repository |
| [decorators/](decorators/README.md) | Tous les décorateurs avec exemples |
| [plugins/](plugins/README.md) | Plugins intégrés (body-parser, OpenAPI, sécurité) |

```
framework/
├── index.ts                    → Réexporte tout le module
├── controllers.ts              → DelegateController (base)
├── services.ts                 → DelegateService (base)
├── repositories.ts             → DelegateRepository (base)
├── view-model.ts               → ViewModel (base)
├── data-transfer-object.ts     → DataTransferObject (validation)
├── encryption.ts               → Encryption (hashing, chiffrement)
├── parameter-bag.ts            → ParameterBag (conteneur typé)
├── artifacts.ts                → Artifacts (registre HMR)
├── env.ts                      → env(), envGroup()
├── decorators/
│   ├── index.ts                → Réexporte tous les décorateurs
│   ├── controllable.decorator.ts   → @Controllable
│   ├── routable.decorator.ts       → @Get, @Post, @Put, @Patch, @Delete...
│   ├── parametrable.decorator.ts   → @Param, @Query, @Body, @Headers...
│   ├── injection.decorator.ts      → @Injectable, @Inject
│   ├── middleware.decorator.ts     → @Middleware
│   ├── socket.decorator.ts         → @Socket, @OnSocket*
│   ├── api.decorator.ts            → @ApiTags, @ApiOperation, @ApiSecurity...
│   ├── api-response.decorator.ts   → @ApiResponse, @ApiOkResponse, @Api*Response
│   └── guard.decorator.ts          → Guards
├── plugins/
│   ├── index.ts                → Réexporte les plugins
│   ├── body-parser.plugin.ts   → bodyParserPlugin
│   ├── openapi.plugin.ts       → openApiPlugin
│   └── security/
│       ├── index.ts            → Security (classe statique)
│       ├── cors.ts             → CORS middleware
│       ├── headers.ts          → Headers sécurité
│       ├── rate-limit.ts       → Rate limiting
│       ├── method-guard.ts     → Méthodes HTTP autorisées
│       └── body-limit.ts       → Taille maximale du body
├── runtime/
│   ├── index.ts                → Runtime (fabrique)
│   ├── node/                   → Adaptateur Node.js (serveur, request, reply)
│   ├── bun/                    → Adaptateur Bun
│   └── deno/                   → Adaptateur Deno (stub)
├── enums/
│   ├── index.ts                → Réexporte les enums
│   ├── http-method.enum.ts     → HttpMethod
│   ├── http-status.enum.ts     → HttpStatus
│   ├── http-parameters.enum.ts → Parametrable
│   ├── runtime.enum.ts         → RuntimeType
│   ├── encrypted.enum.ts       → HashAlgoEnum, CipherAlgoEnum, PasswordAlgoEnum
│   ├── timestamp.enum.ts       → TimestampEnum
│   └── event.message.enum.ts   → EventMessageEnum
├── constants/
│   ├── index.ts
│   ├── decorators.constant.ts  → METADATA_KEYS
│   └── microservices.constant.ts → MICROSERVICE_NAME
├── exceptions/
│   ├── index.ts
│   ├── throwable.ts            → Throwable, throwError, throwException...
│   └── http-exception.ts       → HttpException
├── responses/
│   ├── index.ts
│   ├── http.ts                 → HttpResponse
│   ├── error.ts                → HttpErrorResponse
│   ├── http-throwable.ts       → ThrowableResponse
│   └── helpers.ts              → RaitonResponses
└── utilities/
    ├── index.ts
    ├── artifact.util.ts        → isControllerArtifact, isSocketArtifact...
    ├── callable.util.ts        → retryCallable
    ├── utilities.util.ts       → getType, stabilizeJson
    ├── json.util.ts            → tryParseJson, JsonUtil
    ├── path.util.ts            → getDirname, getFilename, getPackageRoot
    ├── cookie.util.ts          → parseCookie
    ├── ip.util.ts              → getRealIp
    ├── url.ts                  → escapeUrl
    └── openapi.utils.ts        → generateOpenApiSpec, getSchemaFromType
```

---

[← docs/](../README.md) | [↑ Index](../README.md) | [runtime.md →](runtime.md)
