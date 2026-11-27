import fs from "node:fs";
import path from "node:path";
import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, ExitCode, fail, print, silenceStdout} from "../bin/cli-output.ts";
import {RaitonConfig} from "../core/config/config.ts";
import {getConfigJsonSchema} from "../core/config/schema.ts";
import {generateManifest} from "../manifest/manifest.ts";
import {manifestJsonSchema} from "../manifest/schema.ts";
import type {ProjectManifest} from "../manifest/schema.ts";

interface DocsOptions {
    out?: string;
    check?: boolean;
    json?: boolean;
}

const COMMANDS = [
    ["new <name>", "Create a project from a template"],
    ["generate <type> <name>", "Generate controller, service, repository, dto, mcp-tool, test or resource"],
    ["routes", "List mounted routes"],
    ["inspect", "Emit the versioned project manifest"],
    ["why <method> <path>", "Explain which file registered a route"],
    ["call [method] [path]", "Invoke a route with local validation and a structured result"],
    ["requests", "List recently captured requests"],
    ["explain [requestId]", "Explain a request: timeline, root cause and next actions"],
    ["verify", "Call route examples and validate status and output contracts"],
    ["doctor", "Diagnose runtime, configuration and prerequisites"],
    ["openapi export", "Export the OpenAPI document"],
    ["client", "Generate a typed client"],
    ["contract check", "Detect breaking contract changes"],
    ["contract snapshot", "Write a contract baseline"],
    ["mcp list", "List MCP servers"],
    ["mcp inspect <server>", "Inspect MCP schemas and safety annotations"],
    ["mcp test <server>.<tool>", "Call an MCP tool"],
    ["mcp serve [server]", "Serve an MCP server over stdio"],
    ["mcp conformance [server]", "Run the HTTP + stdio conformance suite"],
    ["mcp debug", "Serve the AI-assisted debug MCP server (stdio or HTTP)"],
    ["docs agents", "Generate llms.txt, llms-full.txt, AGENTS.md and CLAUDE.md"],
    ["artifact --dump", "Inspect detected artifacts"],
    ["dev", "Run the application with HMR"],
    ["build", "Build the application"],
    ["start", "Run the application in production"],
] as const;

const GUIDE_FILES = [
    "user-guide/getting-started.md",
    "user-guide/architecture.md",
    "user-guide/cli.md",
    "user-guide/config.md",
    "user-guide/api/routes.md",
    "user-guide/responses.md",
    "user-guide/injection.md",
    "user-guide/artifact-bridge.md",
    "user-guide/contracts.md",
    "user-guide/mcp.md",
    "user-guide/observability.md",
    "user-guide/debug.md",
    "user-guide/decorators/README.md",
    "user-guide/recipes/README.md",
    "user-guide/en/README.md",
    "user-guide/best-practices.md",
];

function relativeRoutes(manifest: ProjectManifest): string {
    if (!manifest.routes.length) return "No route is currently mounted.";
    return manifest.routes
        .map(route => `- \`${route.method} ${route.path}\` → \`${route.controller}.${route.handler}\` (\`${route.file}${route.line ? `:${route.line}` : ""}\`)`)
        .join("\n");
}

function compactIndex(manifest: ProjectManifest): string {
    return `# Raiton

> Modular TypeScript backend framework with dependency injection, plugins, schema-first contracts, MCP (HTTP + stdio), observability and typed CLI tooling.

## Start

- [Getting started](user-guide/getting-started.md): create, run and test a project in under five minutes.
- [Configuration](user-guide/config.md): \`raiton.config.ts\` is typed and validated before the port opens.
- [Contracts](user-guide/recipes/contracts.md): one schema feeds validation, TypeScript types, OpenAPI and the generated client.
- [MCP](user-guide/mcp.md): expose tools over HTTP and stdio with safety annotations.
- [Observability](user-guide/observability.md): correlation ids, Prometheus metrics, OTLP traces and graceful shutdown.

## Commands

${COMMANDS.map(([command, description]) => `- \`raiton ${command}\`: ${description}`).join("\n")}

## Project inventory

- Framework: ${manifest.framework.name} ${manifest.framework.version}
- Runtime: ${manifest.runtime}
- Manifest schema: ${manifest.schemaVersion}
- Routes: ${manifest.routes.length}
- MCP servers: ${manifest.mcp.length}

## Routes

${relativeRoutes(manifest)}
`;
}

function fullReference(manifest: ProjectManifest, docsDir: string): string {
    const sections: string[] = [compactIndex(manifest)];
    for (const file of GUIDE_FILES) {
        const filename = path.join(docsDir, file);
        if (!fs.existsSync(filename)) continue;
        sections.push(`\n\n<!-- ${file} -->\n\n${fs.readFileSync(filename, "utf-8")}`);
    }
    sections.push(`\n\n## Generated manifest\n\n\`\`\`json\n${JSON.stringify(manifest, null, 2)}\n\`\`\`\n`);
    return sections.join("");
}

function agentsGuide(manifest: ProjectManifest): string {
    return `# AGENTS.md — Raiton conventions

This repository uses **Raiton** (${manifest.framework.name} ${manifest.framework.version}).

## Deterministic commands

Always prefer the CLI over guessing conventions:

\`\`\`bash
raiton routes --json      # mounted routes
raiton inspect --json     # versioned manifest (routes, DI, config, env, MCP)
raiton why GET /path      # source file + decorator for a route
raiton doctor --json      # actionable diagnostics
raiton mcp list --json    # MCP servers and tool exposure
\`\`\`

Machine-readable commands write a single JSON document on stdout and logs on stderr.
Exit codes: 0 success, 1 usage, 2 prerequisite missing, 3 file conflict, 4 diagnostic failure.

## Project layout

- \`source/main.ts\` — default export receives the thread and calls \`thread.setup({application}).run()\`.
- \`source/**/*.controller.ts\` — controllers using \`@Controllable\` and \`@Get/@Post/...\`.
- \`source/**/*.service.ts\`, \`.repository.ts\`, \`.dto.ts\` — dependency-injected artifacts.
- \`source/**/*.mcp.ts\` — MCP servers using \`@McpServer\` / \`@McpTool\`.
- \`raiton.config.ts\` — typed project configuration, validated before listening.

## Contracts

Define each route contract once with TypeBox:

\`\`\`ts
import {t} from "raiton/contracts"

export const CreateUser = t.object({email: t.string().email()})
export type CreateUser = t.infer<typeof CreateUser>
\`\`\`

Use \`@Input(CreateUser)\` and \`@Output(User)\`. Invalid input is rejected before the handler with
\`{error: true, code: "VALIDATION_ERROR", details: [{path, code, message}]}\`.

## Known traps

- Destructive MCP tools are hidden unless \`mcp.exposeDestructive\` or the server option is explicit.
- Output validation is enabled in development only by default; do not rely on it in production.
- Do not edit generated files under \`docs/generated\`; run \`raiton docs agents\`.
- Never overwrite generated files without \`--force\`; use \`--dry-run\` first.

## Routes in this project

${relativeRoutes(manifest)}

## MCP

${manifest.mcp.length
    ? manifest.mcp.map(server => `- \`${server.server}\` at \`${server.path}\`: ${server.tools.map(tool => `\`${tool.name}\`${tool.exposed ? "" : " (hidden)"}`).join(", ")}`).join("\n")
    : "No MCP server registered."}
`;
}

function cliReference(): string {
    return `# CLI reference\n\nGenerated by \`raiton docs agents\`. Do not edit by hand.\n\n| Command | Description |\n|---|---|\n${
        COMMANDS.map(([command, description]) => `| \`raiton ${command}\` | ${description} |`).join("\n")
    }\n`;
}

export default class DocsCommand extends RaitonCommand {
    public readonly name = "docs";
    public readonly description = "Generate agent-oriented and reference documentation";

    public register(): void {
        const command = this.cli
            .command("docs")
            .description(this.description);

        command
            .command("agents")
            .description("Generate llms.txt, llms-full.txt, AGENTS.md, CLAUDE.md and generated references")
            .option("--out <directory>", "Documentation directory", "docs")
            .option("--check", "Fail if generated documentation is stale")
            .option("--json", "Emit a machine-readable result on stdout")
            .action((options: DocsOptions) => this.run(options).catch(error => fail(error, options.json)));
    }

    private async run(options: DocsOptions): Promise<void> {
        const execute = async () => this.generate(options);
        const result = options.json ? await silenceStdout(execute) : await execute();

        if (options.json) {
            print(result, true);
            return;
        }

        if (result.stale.length) {
            print("Generated documentation is stale:");
            for (const file of result.stale) print(`  - ${file}`);
            print("Run `raiton docs agents` to regenerate.");
        } else if (options.check) {
            print("Generated documentation is up to date.");
        } else {
            print(`Generated ${result.files.length} documentation file(s) in ${result.output}.`);
        }

        if (result.stale.length) process.exitCode = ExitCode.DIAGNOSTIC_FAILED;
    }

    private async generate(options: DocsOptions): Promise<{
        schemaVersion: string;
        output: string;
        files: string[];
        stale: string[];
    }> {
        await RaitonConfig.sync(this.workdir, {force: true});
        let current: ProjectManifest;
        try {
            const {loadProject} = await import("../bin/project-utils.ts");
            current = (await loadProject(this.workdir, true)).manifest;
        } catch {
            // Projects without a bootstrapper can still publish a partial
            // inventory (configuration, env names, detected artifacts).
            current = generateManifest({refresh: true, workdir: this.workdir});
        }
        // Generated docs must be reproducible in CI: timestamps are excluded.
        const manifest: ProjectManifest = {...current, generatedAt: "generated"};
        const docsDir = path.resolve(this.workdir, options.out ?? "docs");

        const generated: Record<string, string> = {
            "llms.txt": compactIndex(manifest),
            "llms-full.txt": fullReference(manifest, docsDir),
            "AGENTS.md": agentsGuide(manifest),
            "CLAUDE.md": agentsGuide(manifest),
            "generated/manifest-schema.json": JSON.stringify(manifestJsonSchema(), null, 2) + "\n",
            "generated/config-schema.json": JSON.stringify(getConfigJsonSchema(), null, 2) + "\n",
            "generated/cli/commands.md": cliReference(),
            "generated/manifest.json": JSON.stringify(manifest, null, 2) + "\n",
        };

        const stale: string[] = [];
        if (options.check) {
            for (const [relative, content] of Object.entries(generated)) {
                const filename = path.join(docsDir, relative);
                if (!fs.existsSync(filename) || fs.readFileSync(filename, "utf-8") !== content) {
                    stale.push(relative);
                }
            }
            return {schemaVersion: CLI_JSON_SCHEMA_VERSION, output: docsDir, files: Object.keys(generated), stale};
        }

        for (const [relative, content] of Object.entries(generated)) {
            const filename = path.join(docsDir, relative);
            fs.mkdirSync(path.dirname(filename), {recursive: true});
            fs.writeFileSync(filename, content, "utf-8");
        }

        return {schemaVersion: CLI_JSON_SCHEMA_VERSION, output: docsDir, files: Object.keys(generated), stale: []};
    }
}
