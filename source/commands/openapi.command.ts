import path from "node:path";
import fs from "node:fs";
import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, CliError, ExitCode, fail, print} from "../bin/cli-output.ts";
import {loadProject} from "../bin/project-utils.ts";
import {generateOpenApiSpec} from "../framework/utilities/openapi.utils.ts";

interface OpenApiExportOptions {
    out?: string;
    json?: boolean;
    title?: string;
    version?: string;
    description?: string;
    force?: boolean;
    dryRun?: boolean;
}

export default class OpenApiCommand extends RaitonCommand {
    public readonly name = "openapi";
    public readonly description = "Manage the generated OpenAPI document";

    public register(): void {
        const command = this.cli
            .command("openapi")
            .description(this.description);

        command
            .command("export")
            .description("Export the OpenAPI document generated from the live routes")
            .option("--out <file>", "Write the document to a file")
            .option("--title <title>", "API title", "API")
            .option("--version <version>", "API version", "1.0.0")
            .option("--description <description>", "API description", "")
            .option("--force", "Overwrite an existing output file")
            .option("--dry-run", "Print the output plan without writing")
            .option("--json", "Emit the document on stdout")
            .action((options: OpenApiExportOptions) => this.run(options).catch(error => fail(error, options.json)));
    }

    private async run(options: OpenApiExportOptions): Promise<void> {
        const {application} = await loadProject(this.workdir, options.json);
        const rootScope = (application as any).root;
        if (!rootScope) {
            throw new CliError("Application root scope is unavailable", {
                code: "INTROSPECTION_FAILED",
                hint: "Ensure the bootstrapper creates a standard Raiton Application.",
                exitCode: ExitCode.PREREQUISITE_MISSING,
            });
        }

        const spec = await generateOpenApiSpec(rootScope, {
            title: options.title ?? "API",
            version: options.version ?? "1.0.0",
            description: options.description ?? "",
        });

        if (options.out) {
            const filename = path.resolve(this.workdir, options.out);
            if (fs.existsSync(filename) && !options.force) {
                throw new CliError(`Refusing to overwrite existing file: ${path.relative(this.workdir, filename)}`, {
                    code: "FILE_CONFLICT",
                    hint: "Pass --force to overwrite the OpenAPI document explicitly.",
                    location: filename,
                    exitCode: ExitCode.FILE_CONFLICT,
                });
            }
            if (options.dryRun) {
                if (options.json) {
                    print({schemaVersion: CLI_JSON_SCHEMA_VERSION, status: "planned", file: path.relative(this.workdir, filename)}, true);
                } else {
                    print(`Would write OpenAPI document to ${path.relative(process.cwd(), filename)}`);
                }
                return;
            }
            fs.mkdirSync(path.dirname(filename), {recursive: true});
            fs.writeFileSync(filename, JSON.stringify(spec, null, 2) + "\n", "utf-8");
            if (options.json) {
                print({schemaVersion: CLI_JSON_SCHEMA_VERSION, status: "exported", file: path.relative(this.workdir, filename), paths: Object.keys(spec.paths ?? {}).length}, true);
            } else {
                print(`OpenAPI document written to ${path.relative(process.cwd(), filename)}`);
            }
            return;
        }

        if (options.json) {
            print(spec, true);
            return;
        }

        print(`OpenAPI ${spec.openapi} — ${Object.keys(spec.paths ?? {}).length} path(s)`);
        for (const [route, item] of Object.entries(spec.paths ?? {})) {
            print(`  ${Object.keys(item as any).join(",").toUpperCase().padEnd(8)} ${route}`);
        }
    }
}
