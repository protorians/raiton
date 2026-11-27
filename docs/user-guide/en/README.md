# Raiton user guide (English)

This is the English reference for the same contract as the French guide.

## Start

```bash
bun raiton new my-api --template api --runtime bun --yes
cd my-api
bun raiton dev
```

- `GET /api/health` — health check.
- Example controller route under `/api/<project>`.
- `bun test` — generated tests.

## Configuration

`raiton.config.ts` is typed and validated before the port opens. Invalid fields prevent listening and report each field.

```ts
import {defineConfigSync} from "raiton/core"

export default defineConfigSync({
  rootDir: "./source",
  port: 5711,
  prefix: "/api",
  observability: {mode: "off"},
  validation: {responses: "auto"},
})
```

## Contracts

One schema feeds runtime validation, TypeScript types, OpenAPI and the generated client:

```ts
import {t} from "raiton/contracts"

export const CreateUser = t.object({email: t.string().email()})
export type CreateUser = t.infer<typeof CreateUser>
```

Use `@Input(CreateUser)` / `@Output(User)`. Invalid input is rejected before the handler with a stable `VALIDATION_ERROR` payload.

## CLI

All diagnostic and generation commands support `--json`, stable exit codes and non-interactive operation.

```bash
raiton routes --json
raiton inspect --json
raiton why GET /api/users/:id
raiton doctor --json
raiton openapi export --out openapi.json
raiton client --out ./sdk
raiton contract check --baseline openapi.baseline.json
raiton mcp list --json
raiton mcp conformance --json
raiton docs agents
```

Exit codes: `0` success, `1` usage, `2` missing prerequisite, `3` file conflict, `4` diagnostic failure.

## MCP

```ts
@McpServer({name: "math", path: "/mcp"})
export class MathServer {
  @McpTool({name: "add", annotations: {readOnlyHint: true}})
  add(@McpArg("a", "First", Number) a: number, @McpArg("b", "Second", Number) b: number) {
    return {result: a + b}
  }
}
```

- HTTP and stdio transports share the same conformance suite.
- Destructive tools are hidden unless `mcp.exposeDestructive` or the server option is explicit.
- Tool calls are audited and secrets are redacted.

## Observability

See [observability](../observability.md) for correlation ids, Prometheus metrics, OTLP traces and graceful shutdown.
