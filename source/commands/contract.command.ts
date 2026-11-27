import path from "node:path";
import fs from "node:fs";
import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, CliError, ExitCode, fail, print} from "../bin/cli-output.ts";
import {loadProject} from "../bin/project-utils.ts";
import {checkContracts} from "../manifest/contract.ts";
import {readJsonFile} from "../bin/file-utils.ts";

interface CheckOptions {
    baseline: string;
    json?: boolean;
}

interface SnapshotOptions {
    out: string;
    json?: boolean;
    force?: boolean;
    dryRun?: boolean;
}

export default class ContractCommand extends RaitonCommand {
    public readonly name = "contract";
    public readonly description = "Check published route contracts for breaking changes";

    public register(): void {
        const command = this.cli
            .command("contract")
            .description(this.description);

        command
            .command("check")
            .description("Compare current contracts to a baseline")
            .requiredOption("--baseline <file>", "Baseline manifest or OpenAPI document")
            .option("--json", "Emit a machine-readable result on stdout")
            .action((options: CheckOptions) => this.check(options).catch(error => fail(error, options.json)));

        command
            .command("snapshot")
            .description("Write the current contracts as a baseline manifest")
            .requiredOption("--out <file>", "Output manifest file")
            .option("--force", "Overwrite an existing baseline")
            .option("--dry-run", "Print the output plan without writing")
            .option("--json", "Emit a machine-readable result on stdout")
            .action((options: SnapshotOptions) => this.snapshot(options).catch(error => fail(error, options.json)));
    }

    private async check(options: CheckOptions): Promise<void> {
        const {manifest} = await loadProject(this.workdir, options.json);
        const baselineFile = path.resolve(this.workdir, options.baseline);
        const baseline = readJsonFile(baselineFile);
        const result = checkContracts(manifest, baseline);

        if (options.json) {
            print({
                schemaVersion: CLI_JSON_SCHEMA_VERSION,
                compatible: result.compatible,
                checked: result.checked,
                breaking: result.breaking,
            }, true);
        } else {
            if (result.compatible) {
                print(`Contracts compatible (${result.checked} route(s) checked).`);
            } else {
                print(`Breaking contract change(s) detected:`);
                for (const change of result.breaking) {
                    print(`  [${change.kind}] ${change.route}${change.field ? ` · ${change.field}` : ""}: ${change.message}`);
                }
            }
        }

        if (!result.compatible) {
            process.exitCode = ExitCode.USAGE;
        }
    }

    private async snapshot(options: SnapshotOptions): Promise<void> {
        const {manifest} = await loadProject(this.workdir, options.json);
        const filename = path.resolve(this.workdir, options.out);
        if (fs.existsSync(filename) && !options.force) {
            throw new CliError(`Refusing to overwrite existing baseline: ${path.relative(this.workdir, filename)}`, {
                code: "FILE_CONFLICT",
                hint: "Pass --force to overwrite the contract baseline explicitly.",
                location: filename,
                exitCode: ExitCode.FILE_CONFLICT,
            });
        }
        if (options.dryRun) {
            if (options.json) {
                print({schemaVersion: CLI_JSON_SCHEMA_VERSION, status: "planned", file: path.relative(this.workdir, filename)}, true);
            } else {
                print(`Would write contract baseline to ${path.relative(process.cwd(), filename)}`);
            }
            return;
        }
        fs.mkdirSync(path.dirname(filename), {recursive: true});
        fs.writeFileSync(filename, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

        if (options.json) {
            print({schemaVersion: CLI_JSON_SCHEMA_VERSION, status: "snapshot", file: filename, routes: manifest.routes.length}, true);
        } else {
            print(`Contract baseline written to ${path.relative(process.cwd(), filename)}`);
        }
    }
}
