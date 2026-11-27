# AGENTS.md — Raiton conventions

This repository uses **Raiton** (raiton 6.8.9-beta.25).

## Deterministic commands

Always prefer the CLI over guessing conventions:

```bash
raiton routes --json      # mounted routes
raiton inspect --json     # versioned manifest (routes, DI, config, env, MCP)
raiton why GET /path      # source file + decorator for a route
raiton doctor --json      # actionable diagnostics
raiton mcp list --json    # MCP servers and tool exposure
```

Machine-readable commands write a single JSON document on stdout and logs on stderr.
Exit codes: 0 success, 1 usage, 2 prerequisite missing, 3 file conflict, 4 diagnostic failure.

## Project layout

- `source/main.ts` — default export receives the thread and calls `thread.setup({application}).run()`.
- `source/**/*.controller.ts` — controllers using `@Controllable` and `@Get/@Post/...`.
- `source/**/*.service.ts`, `.repository.ts`, `.dto.ts` — dependency-injected artifacts.
- `source/**/*.mcp.ts` — MCP servers using `@McpServer` / `@McpTool`.
- `raiton.config.ts` — typed project configuration, validated before listening.

## Contracts

Define each route contract once with TypeBox:

```ts
import {t} from "raiton/contracts"

export const CreateUser = t.object({email: t.string().email()})
export type CreateUser = t.infer<typeof CreateUser>
```

Use `@Input(CreateUser)` and `@Output(User)`. Invalid input is rejected before the handler with
`{error: true, code: "VALIDATION_ERROR", details: [{path, code, message}]}`.

## Known traps

- Destructive MCP tools are hidden unless `mcp.exposeDestructive` or the server option is explicit.
- Output validation is enabled in development only by default; do not rely on it in production.
- Do not edit generated files under `docs/generated`; run `raiton docs agents`.
- Never overwrite generated files without `--force`; use `--dry-run` first.

## Routes in this project

No route is currently mounted.

## MCP

No MCP server registered.
