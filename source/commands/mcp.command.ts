import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, CliError, ExitCode, fail, print} from "../bin/cli-output.ts";
import {loadProject} from "../bin/project-utils.ts";
import {getMcpServer, getMcpServerRegistry} from "../core/mcp/metadata.ts";
import {RaitonConfig} from "../core/config/config.ts";
import {handleMcpRequest} from "../framework/mcp/handler.ts";
import {runAllConformance} from "../framework/mcp/conformance.ts";
import {serveMcpStdio} from "../framework/mcp/stdio.ts";
import type {McpInvocationContext} from "../types/index.ts";

interface ListOptions {
    json?: boolean;
}

interface InspectOptions {
    json?: boolean;
}

interface TestOptions {
    args?: string;
    scopes?: string;
    json?: boolean;
}

interface ServeOptions {
    stdio?: boolean;
    json?: boolean;
}

interface ConformanceOptions {
    json?: boolean;
}

function parseArgs(value?: string): Record<string, any> {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("arguments must be a JSON object");
        }
        return parsed;
    } catch (error: any) {
        throw new CliError(`Invalid --args JSON: ${error.message}`, {
            code: "INVALID_ARGUMENTS",
            hint: "Pass a JSON object, for example --args '{\"a\":1,\"b\":2}'.",
            exitCode: ExitCode.USAGE,
        });
    }
}

export default class McpCommand extends RaitonCommand {
    public readonly name = "mcp";
    public readonly description = "Inspect, test and serve MCP servers";

    public register(): void {
        const command = this.cli
            .command("mcp")
            .description(this.description);

        command
            .command("list")
            .description("List MCP servers and their tools")
            .option("--json", "Emit JSON on stdout")
            .action((options: ListOptions) => this.list(options).catch(error => fail(error, options.json)));

        command
            .command("inspect <server>")
            .description("Show the schemas and safety annotations of an MCP server")
            .option("--json", "Emit JSON on stdout")
            .action((server: string, options: InspectOptions) => this.inspect(server, options).catch(error => fail(error, options.json)));

        command
            .command("test <target>")
            .description("Call a tool; target is <server>.<tool> or <tool>")
            .option("--args <json>", "JSON object of tool arguments", "{}")
            .option("--scopes <scopes>", "Comma-separated scopes for the call", "")
            .option("--json", "Emit JSON on stdout")
            .action((target: string, options: TestOptions) => this.test(target, options).catch(error => fail(error, options.json)));

        command
            .command("serve [server]")
            .description("Serve an MCP server over stdin/stdout")
            .option("--stdio", "Use the stdio transport (default)", true)
            .option("--json", "Emit JSON (not compatible with a long-running server)")
            .action((server: string | undefined, options: ServeOptions) => this.serve(server, options).catch(error => fail(error, options.json)));

        command
            .command("conformance [server]")
            .description("Run the shared HTTP and stdio MCP conformance suite")
            .option("--json", "Emit JSON on stdout")
            .action((server: string | undefined, options: ConformanceOptions) => this.conformance(server, options).catch(error => fail(error, options.json)));
    }

    private async list(options: ListOptions): Promise<void> {
        const {manifest} = await loadProject(this.workdir, options.json);
        if (options.json) {
            print({schemaVersion: CLI_JSON_SCHEMA_VERSION, servers: manifest.mcp}, true);
            return;
        }
        if (!manifest.mcp.length) {
            print("No MCP server registered.");
            return;
        }
        for (const server of manifest.mcp) {
            print(`${server.server}  ${server.path}  (${server.tools.length} tool(s))`);
            for (const tool of server.tools) {
                print(`  - ${tool.name}${tool.exposed ? "" : " [hidden: destructive]"}`);
            }
        }
    }

    private async inspect(name: string, options: InspectOptions): Promise<void> {
        await loadProject(this.workdir, options.json);
        const entry = getMcpServer(name);
        if (!entry) {
            throw new CliError(`MCP server not found: ${name}`, {
                code: "MCP_SERVER_NOT_FOUND",
                hint: `Available servers: ${[...getMcpServerRegistry().keys()].join(", ") || "none"}.`,
                exitCode: ExitCode.USAGE,
            });
        }

        const payload = {
            server: entry.name,
            path: entry.path,
            version: entry.version,
            description: entry.description,
            exposeDestructive: entry.metadata.exposeDestructive,
            tools: entry.metadata.tools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
                outputSchema: tool.outputSchema,
                annotations: tool.annotations,
                scopes: tool.scopes,
                exposed: !(tool.annotations?.destructiveHint === true || tool.destructive === true)
                    || entry.metadata.exposeDestructive === true
                    || RaitonConfig.get("mcp")?.exposeDestructive === true,
            })),
            prompts: entry.metadata.prompts,
            resources: entry.metadata.resources,
            resourceTemplates: entry.metadata.resourceTemplates,
        };

        if (options.json) {
            print({schemaVersion: CLI_JSON_SCHEMA_VERSION, ...payload}, true);
            return;
        }

        print(`${payload.server} ${payload.path} (${payload.version})`);
        for (const tool of payload.tools) {
            print(`  - ${tool.name}${tool.exposed ? "" : " [hidden]"}: ${tool.description ?? ""}`);
            if (tool.inputSchema) print(`      input: ${JSON.stringify(tool.inputSchema)}`);
            if (tool.outputSchema) print(`      output: ${JSON.stringify(tool.outputSchema)}`);
            if (tool.annotations) print(`      annotations: ${JSON.stringify(tool.annotations)}`);
        }
    }

    private async test(target: string, options: TestOptions): Promise<void> {
        await loadProject(this.workdir, options.json);
        const [serverName, toolName] = target.includes(".")
            ? target.split(".", 2)
            : [[...getMcpServerRegistry().keys()][0], target];

        const entry = getMcpServer(serverName);
        if (!entry) {
            throw new CliError(`MCP server not found: ${serverName}`, {
                code: "MCP_SERVER_NOT_FOUND",
                hint: `Available servers: ${[...getMcpServerRegistry().keys()].join(", ") || "none"}.`,
                exitCode: ExitCode.USAGE,
            });
        }

        const context: McpInvocationContext = {
            actor: "raiton-cli",
            transport: "streamable-http",
            scopes: (options.scopes ?? "").split(",").map(scope => scope.trim()).filter(Boolean),
        };

        const handled = await handleMcpRequest(entry, {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/call",
            params: {name: toolName, arguments: parseArgs(options.args)},
        }, context);

        const message: any = Array.isArray(handled.message) ? handled.message[0] : handled.message;
        if (message?.error) {
            throw new CliError(message.error.message, {
                code: "MCP_CALL_FAILED",
                hint: `Run \`raiton mcp inspect ${entry.name}\` to check the tool name and input schema.`,
                exitCode: ExitCode.USAGE,
            });
        }

        const result = message?.result;
        if (options.json) {
            print({schemaVersion: CLI_JSON_SCHEMA_VERSION, server: entry.name, tool: toolName, ok: !result?.isError, result}, true);
        } else {
            print(JSON.stringify(result, null, 2));
        }

        if (result?.isError) process.exitCode = ExitCode.USAGE;
    }

    private async serve(name: string | undefined, options: ServeOptions): Promise<void> {
        if (options.json) {
            throw new CliError("`mcp serve` is a long-running server and cannot emit a single JSON document", {
                code: "INVALID_OPTION",
                hint: "Omit --json when serving over stdio.",
                exitCode: ExitCode.USAGE,
            });
        }

        // stdout is the stdio protocol channel: silence every incidental log
        // while booting the project.
        await loadProject(this.workdir, true);
        const entry = name ? getMcpServer(name) : [...getMcpServerRegistry().values()][0];
        if (!entry) {
            throw new CliError(name ? `MCP server not found: ${name}` : "No MCP server registered", {
                code: "MCP_SERVER_NOT_FOUND",
                hint: "Add a `@McpServer` class in a `*.mcp.ts` file.",
                exitCode: ExitCode.PREREQUISITE_MISSING,
            });
        }

        process.stderr.write(`[raiton:mcp] serving ${entry.name} over stdio\n`);
        await serveMcpStdio(entry);
    }

    private async conformance(name: string | undefined, options: ConformanceOptions): Promise<void> {
        await loadProject(this.workdir, options.json);
        const entry = name ? getMcpServer(name) : [...getMcpServerRegistry().values()][0];
        if (!entry) {
            throw new CliError("No MCP server registered", {
                code: "MCP_SERVER_NOT_FOUND",
                hint: "Add a `@McpServer` class in a `*.mcp.ts` file.",
                exitCode: ExitCode.PREREQUISITE_MISSING,
            });
        }

        const results = await runAllConformance(entry);
        const passed = results.every(result => result.passed);

        if (options.json) {
            print({schemaVersion: CLI_JSON_SCHEMA_VERSION, passed, results}, true);
        } else {
            for (const result of results) {
                print(`${result.passed ? "PASS" : "FAIL"} ${result.transport}`);
                for (const check of result.checks) {
                    print(`  ${check.passed ? "ok" : "fail"} ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
                }
            }
        }

        if (!passed) process.exitCode = ExitCode.DIAGNOSTIC_FAILED;
    }
}
