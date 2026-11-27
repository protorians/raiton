# Recettes exécutables

Chaque fonctionnalité publique dispose d'une recette : objectif, fichier complet, commande, sortie attendue.
Une recette qui ne s'exécute pas en CI est considérée comme cassée.

| Fonctionnalité | Recette | Commande |
|---|---|---|
| Création de projet | [new-project.md](new-project.md) | `raiton new demo --template api --yes` |
| Génération d'artifacts | [generate.md](generate.md) | `raiton generate resource users` |
| Contrats schema-first | [contracts.md](contracts.md) | `raiton contract check --baseline baseline.json` |
| MCP HTTP + stdio | [mcp-stdio.md](mcp-stdio.md) | `raiton mcp conformance --json` |
| Manifeste et découverte | [manifest.md](manifest.md) | `raiton inspect --json` |
| Observabilité | [observability.md](observability.md) | `RAITON_OBSERVABILITY=all raiton dev` |
| Diagnostic | [doctor.md](doctor.md) | `raiton doctor --json` |

## Couverture des décorateurs

| Décorateur | Documentation |
|---|---|
| `@Controllable` | [../decorators/controllable.md](../decorators/controllable.md) |
| `@Get/@Post/@Put/@Patch/@Delete` | [../decorators/routes.md](../decorators/routes.md) |
| `@Body/@Query/@Param/@Headers/@Cookie` | [../decorators/parameters.md](../decorators/parameters.md) |
| `@Injectable/@Inject` | [../decorators/injection.md](../decorators/injection.md) |
| `@Middleware` | [../decorators/middleware.md](../decorators/middleware.md) |
| `@Guard` | [../decorators/guard.md](../decorators/guard.md) |
| `@Cache` | [../decorators/cache.md](../decorators/cache.md) |
| `@HealthCheck` | [../decorators/health-check.md](../decorators/health-check.md) |
| `@McpServer/@McpTool/@McpArg` | [../decorators/mcp.md](../decorators/mcp.md) |
| `@Scheduler` | [../decorators/scheduler.md](../decorators/scheduler.md) |
| `@Socket` | [../decorators/socket.md](../decorators/socket.md) |
| `@ApiOperation/@ApiResponse/@ApiProperty` | [../decorators/api-operation.md](../decorators/api-operation.md) |
| `@Input/@Output` | [contracts.md](contracts.md) |
