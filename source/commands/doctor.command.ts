import fs from "node:fs";
import path from "node:path";
import net from "node:net";
import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, ExitCode, fail, print, silenceStdout} from "../bin/cli-output.ts";
import {RaitonConfig} from "../core/config/config.ts";
import {errorDocsUrl} from "../framework/errors/catalog.ts";
import {loadProject} from "../bin/project-utils.ts";
import {isBunUsed, isDenoUsed} from "../bin/constants.ts";
import {BridgeLoader} from "../core/bridge/loader.ts";
import type {BridgeDiagnostic} from "../types/bridge.ts";

type Severity = "error" | "warning" | "info";

interface DiagnosticIssue {
    code: string;
    severity: Severity;
    message: string;
    action: string;
    docsUrl: string;
    location?: string;
}

interface DoctorOptions {
    json?: boolean;
    fix?: boolean;
}

function runtimeVersion(): {name: string; version: string} {
    const versions = process.versions as any;
    if (isBunUsed) return {name: "bun", version: versions.bun ?? "unknown"};
    if (isDenoUsed) return {name: "deno", version: versions.deno ?? "unknown"};
    return {name: "node", version: versions.node ?? "unknown"};
}

function portAvailable(port: number): Promise<boolean> {
    return new Promise(resolve => {
        const server = net.createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => server.close(() => resolve(true)));
        server.listen(port, "127.0.0.1");
    });
}

export default class DoctorCommand extends RaitonCommand {
    public readonly name = "doctor";
    public readonly description = "Diagnose the runtime, configuration and project prerequisites";

    public register(): void {
        this.cli
            .command("doctor")
            .description(this.description)
            .option("--json", "Emit diagnostics as JSON on stdout")
            .option("--fix", "Apply safe, non-destructive fixes")
            .action((options: DoctorOptions) => this.run(options).catch(error => fail(error, options.json)));
    }

    private async run(options: DoctorOptions): Promise<void> {
        const execute = async () => this.diagnose(options);
        const result = options.json ? await silenceStdout(execute) : await execute();

        if (options.json) {
            print(result, true);
        } else {
            for (const issue of result.issues) {
                const label = issue.severity.toUpperCase().padEnd(7);
                print(`${label} [${issue.code}] ${issue.message}`);
                print(`        action: ${issue.action}`);
                if (issue.location) print(`        location: ${issue.location}`);
            }
            if (!result.issues.length) print("No issue detected.");
            else print(`\n${result.summary.errors} error(s), ${result.summary.warnings} warning(s), ${result.summary.infos} info.`);
            if (result.fixed.length) print(`Applied fixes: ${result.fixed.join(", ")}`);
        }

        if (result.summary.errors > 0) process.exitCode = ExitCode.DIAGNOSTIC_FAILED;
    }

    private async diagnose(options: DoctorOptions): Promise<{
        schemaVersion: string;
        issues: DiagnosticIssue[];
        summary: {errors: number; warnings: number; infos: number};
        fixed: string[];
        runtime: {name: string; version: string};
    }> {
        const issues: DiagnosticIssue[] = [];
        const fixed: string[] = [];
        const add = (
            code: string,
            severity: Severity,
            message: string,
            action: string,
            docsPath = "user-guide/cli.md",
            location?: string,
        ) => issues.push({code, severity, message, action, docsUrl: errorDocsUrl(docsPath), location});

        const runtime = runtimeVersion();
        add("RUNTIME", "info", `Runtime: ${runtime.name} ${runtime.version}`, "No action required.");

        const packageFile = path.join(this.workdir, "package.json");
        if (!fs.existsSync(packageFile)) {
            add("PACKAGE_MISSING", "error", "package.json not found", "Run `raiton new` or create a package.json.", "user-guide/getting-started.md", packageFile);
        } else {
            try {
                const pkg = JSON.parse(fs.readFileSync(packageFile, "utf-8"));
                const raitonVersion = pkg.dependencies?.raiton ?? pkg.devDependencies?.raiton;
                if (raitonVersion) {
                    add("FRAMEWORK_VERSION", "info", `Raiton dependency: ${raitonVersion}`, "No action required.");
                }
                if (!pkg.dependencies?.raiton && !pkg.devDependencies?.raiton) {
                    add("RAITON_MISSING", "error", "The `raiton` dependency is not declared", "Run `bun add raiton` in the project.", "user-guide/getting-started.md", packageFile);
                }
                if (!pkg.dependencies?.["reflect-metadata"] && !pkg.devDependencies?.["reflect-metadata"]) {
                    add("REFLECT_METADATA_MISSING", "warning", "`reflect-metadata` is not declared", "Run `bun add reflect-metadata` and import it in main.ts.", "user-guide/getting-started.md", packageFile);
                }
            } catch (error: any) {
                add("PACKAGE_INVALID", "error", `package.json is invalid JSON: ${error.message}`, "Fix package.json syntax.", "user-guide/getting-started.md", packageFile);
            }
        }

        await RaitonConfig.sync(this.workdir, {force: true});
        if (!RaitonConfig.source) {
            add("CONFIG_MISSING", "warning", "No raiton.config.ts/js/json found", "Run `raiton new` or add a raiton.config.ts file.", "user-guide/config.md", this.workdir);
        }
        for (const configError of RaitonConfig.errors) {
            add("CONFIG_FIELD", "error", `Configuration: ${configError.field} ${configError.message}`, "Fix the field in raiton.config.*.", "user-guide/config.md", RaitonConfig.source ?? undefined);
        }

        // Bridge diagnostics are non-throwing so doctor can report every issue
        // instead of stopping at the first invalid declaration.
        const bridgeDiagnostics: BridgeDiagnostic[] = BridgeLoader.diagnose(this.workdir);
        for (const diagnostic of bridgeDiagnostics) {
            issues.push({
                code: diagnostic.code,
                severity: diagnostic.severity,
                message: diagnostic.message,
                action: diagnostic.action,
                docsUrl: diagnostic.docsUrl,
                location: diagnostic.location,
            });
        }

        const root = path.resolve(this.workdir, RaitonConfig.get("rootDir") || "./");
        if (!fs.existsSync(root)) {
            add("SOURCE_MISSING", "error", `Source directory not found: ${path.relative(this.workdir, root)}`, "Create the directory or fix rootDir.", "user-guide/config.md", root);
        }
        const entry = path.join(root, "main.ts");
        if (!fs.existsSync(entry)) {
            add("ENTRY_MISSING", "error", "Entry point source/main.ts not found", "Create source/main.ts exporting a default bootstrapper.", "user-guide/getting-started.md", entry);
        }

        const tsconfig = path.join(this.workdir, "tsconfig.json");
        if (!fs.existsSync(tsconfig)) {
            add("TSCONFIG_MISSING", "warning", "tsconfig.json not found", "Add a tsconfig with experimentalDecorators and emitDecoratorMetadata.", "user-guide/getting-started.md", tsconfig);
        } else {
            const content = fs.readFileSync(tsconfig, "utf-8");
            if (!content.includes("experimentalDecorators")) {
                add("DECORATORS_DISABLED", "warning", "tsconfig.json does not enable experimentalDecorators", "Enable experimentalDecorators for controllers and MCP tools.", "user-guide/getting-started.md", tsconfig);
            }
            if (!content.includes("emitDecoratorMetadata")) {
                add("DECORATOR_METADATA_DISABLED", "warning", "tsconfig.json does not enable emitDecoratorMetadata", "Enable emitDecoratorMetadata so dependency injection can resolve types.", "user-guide/injection.md", tsconfig);
            }
        }

        const port = RaitonConfig.get("port");
        if (port) {
            if (!(await portAvailable(port))) {
                add("PORT_IN_USE", "error", `Port ${port} is already in use or unavailable`, `Stop the process using port ${port} or change the port in raiton.config.ts.`, "user-guide/config.md");
            } else {
                add("PORT_AVAILABLE", "info", `Port ${port} is available`, "No action required.");
            }
        }

        // Project-level introspection: decorators, routes, MCP and env coverage.
        try {
            const {manifest} = await loadProject(this.workdir, true);

            if (BridgeLoader.state.loaded) {
                const state = BridgeLoader.state;
                add(
                    "BRIDGE_LOADED",
                    "info",
                    `Bridge loaded: ${state.artifacts.length} artifact(s), ${state.packages.length} package(s)`,
                    "No action required.",
                    "user-guide/artifact-bridge.md",
                    state.sourceFile ?? undefined,
                );
                for (const diagnostic of state.diagnostics) {
                    if (issues.some(issue => issue.code === diagnostic.code && issue.message === diagnostic.message)) continue;
                    issues.push({
                        code: diagnostic.code,
                        severity: diagnostic.severity,
                        message: diagnostic.message,
                        action: diagnostic.action,
                        docsUrl: diagnostic.docsUrl,
                        location: diagnostic.location,
                    });
                }
            }

            const envIssue = await this.fixEnv(manifest.env, options.fix, fixed);
            if (envIssue) add(...envIssue);

            const applicationRoutes = manifest.routes.filter(route => route.controller !== "Application");
            if (applicationRoutes.length === 0) {
                add("NO_ROUTES", "warning", "No controller route was registered", "Add a `@Controllable` controller in source/.", "user-guide/decorators/controllable.md");
            } else {
                add("ROUTES", "info", `${applicationRoutes.length} controller route(s) registered`, "No action required.");
            }

            if (manifest.artifacts.length === 0) {
                add("NO_ARTIFACTS", "warning", "No artifact file was detected", "Use the documented filename suffixes (e.g. `.controller.ts`, `.service.ts`).", "user-guide/architecture.md");
            }

            for (const name of manifest.env) {
                if (process.env[name] === undefined) {
                    add("ENV_MISSING", "warning", `Environment variable ${name} is not set`, `Add ${name} to .env or the process environment.`, "user-guide/env.md");
                }
            }

            for (const server of manifest.mcp) {
                const hidden = server.tools.filter(tool => !tool.exposed);
                if (hidden.length) {
                    add("MCP_DESTRUCTIVE_HIDDEN", "info", `${hidden.length} destructive MCP tool(s) hidden in ${server.server}`, "Set mcp.exposeDestructive=true or server exposeDestructive:true to expose them.", "user-guide/mcp.md");
                }
            }
        } catch (error: any) {
            if (error?.code && String(error.code).startsWith("BRIDGE_")) {
                const message = error.message;
                if (!issues.some(issue => issue.code === error.code && issue.message === message)) {
                    issues.push({
                        code: error.code,
                        severity: "error",
                        message,
                        action: error.diagnostic?.action ?? error.hint ?? "Fix the bridge declaration and retry.",
                        docsUrl: error.diagnostic?.docsUrl ?? error.docsUrl ?? errorDocsUrl("user-guide/artifact-bridge.md"),
                        location: error.diagnostic?.location ?? error.location,
                    });
                }
            } else if (error?.code !== "PREREQUISITE_MISSING") {
                add("INTROSPECTION_FAILED", "error", `Could not inspect the project: ${error.message}`, "Fix the bootstrapper, then run `raiton doctor` again.", "user-guide/cli.md");
            }
        }

        const summary = {
            errors: issues.filter(issue => issue.severity === "error").length,
            warnings: issues.filter(issue => issue.severity === "warning").length,
            infos: issues.filter(issue => issue.severity === "info").length,
        };

        return {schemaVersion: CLI_JSON_SCHEMA_VERSION, issues, summary, fixed, runtime};
    }

    private async fixEnv(
        names: string[],
        fix: boolean | undefined,
        fixed: string[],
    ): Promise<[string, Severity, string, string, string, string?] | null> {
        if (!names.length) return null;
        const file = path.join(this.workdir, ".env.example");
        if (fs.existsSync(file)) return null;

        if (fix) {
            fs.writeFileSync(file, names.map(name => `${name}=`).join("\n") + "\n", "utf-8");
            fixed.push(".env.example");
            return null;
        }

        return [
            "ENV_EXAMPLE_MISSING",
            "warning",
            `.env.example is missing (${names.length} variable(s) detected)`,
            "Run `raiton doctor --fix` to generate it.",
            "user-guide/env.md",
            file,
        ];
    }
}
