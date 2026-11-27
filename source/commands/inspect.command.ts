import path from "node:path";
import fs from "node:fs";
import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, CliError, ExitCode, fail, print, silenceStdout} from "../bin/cli-output.ts";
import {loadProject} from "../bin/project-utils.ts";
import {writeManifest} from "../manifest/manifest.ts";
import {manifestJsonSchema, validateManifest} from "../manifest/schema.ts";
import {getConfigJsonSchema} from "../core/config/schema.ts";
import {RaitonConfig} from "../core/config/config.ts";

interface InspectOptions {
    json?: boolean;
    out?: string;
    schema?: boolean;
    configSchema?: boolean;
    check?: boolean;
    force?: boolean;
}

export default class InspectCommand extends RaitonCommand {
    public readonly name = "inspect";
    public readonly description = "Emit the machine-readable project inventory";

    public register(): void {
        this.cli
            .command("inspect")
            .description(this.description)
            .option("--json", "Emit the manifest as JSON on stdout")
            .option("--out <file>", "Write the manifest to a file")
            .option("--schema", "Print the published manifest JSON Schema")
            .option("--config-schema", "Print the published configuration JSON Schema")
            .option("--check", "Validate the manifest and exit non-zero on schema errors")
            .option("--force", "Overwrite an existing manifest output file")
            .action((options: InspectOptions) => this.run(options).catch(error => fail(error, options.json)));
    }

    private async run(options: InspectOptions): Promise<void> {
        if (options.schema) {
            print(manifestJsonSchema(), true);
            return;
        }

        if (options.configSchema) {
            print(await silenceStdout(async () => {
                await RaitonConfig.sync(this.workdir, {force: true});
                return getConfigJsonSchema();
            }), true);
            return;
        }

        const {manifest} = await loadProject(this.workdir, options.json);
        const validation = validateManifest(manifest);

        if (!validation.valid) {
            const error = new CliError("Manifest does not match its published schema", {
                code: "INVALID_MANIFEST",
                hint: "This is a framework bug; include the errors in a GitHub issue.",
                details: validation.errors,
                exitCode: ExitCode.DIAGNOSTIC_FAILED,
            } as any);
            if (options.json) {
                print({
                    error: true,
                    schemaVersion: CLI_JSON_SCHEMA_VERSION,
                    code: "INVALID_MANIFEST",
                    details: validation.errors,
                    docsUrl: error.docsUrl,
                }, true);
                process.exitCode = ExitCode.DIAGNOSTIC_FAILED;
                return;
            }
            throw error;
        }

        if (options.out) {
            const filename = path.resolve(this.workdir, options.out);
            if (fs.existsSync(filename) && !options.force) {
                throw new CliError(`Refusing to overwrite existing manifest: ${path.relative(this.workdir, filename)}`, {
                    code: "FILE_CONFLICT",
                    hint: "Pass --force to overwrite the manifest explicitly.",
                    location: filename,
                    exitCode: ExitCode.FILE_CONFLICT,
                });
            }
            writeManifest(filename, manifest);
            if (!options.json) print(`Manifest written to ${path.relative(process.cwd(), filename)}`);
        }

        if (options.check) {
            if (options.json) print({valid: true, schemaVersion: manifest.schemaVersion}, true);
            else print(`Manifest valid (schema ${manifest.schemaVersion}, ${manifest.routes.length} route(s)).`);
            return;
        }

        if (options.json) {
            print(manifest, true);
        } else {
            print(`Manifest ${manifest.schemaVersion} · ${manifest.framework.name} ${manifest.framework.version}`);
            print(`Routes: ${manifest.routes.length} · artifacts: ${manifest.artifacts.length} · MCP servers: ${manifest.mcp.length}`);
            if (manifest.routes.length) {
                for (const route of manifest.routes) {
                    print(`  ${route.method.padEnd(6)} ${route.path}  → ${route.controller}.${route.handler} (${route.file}:${route.line})`);
                }
            }
            print("Use --json for the full machine-readable inventory.");
        }
    }
}
