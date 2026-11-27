import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, fail, print} from "../bin/cli-output.ts";
import {writeFiles} from "../bin/file-utils.ts";
import {artifactFiles, assertArtifactType} from "../generators/artifact.templates.ts";

interface GenerateOptions {
    dryRun?: boolean;
    force?: boolean;
    json?: boolean;
}

export default class GenerateCommand extends RaitonCommand {
    public readonly name = "generate";
    public readonly description = "Generate a framework artifact";

    public register(): void {
        this.cli
            .command("generate <type> <name>")
            .alias("g")
            .description("Generate an artifact: controller, service, repository, dto, mcp-tool, test, resource")
            .option("--dry-run", "Print the file plan without writing anything")
            .option("--force", "Overwrite existing files explicitly")
            .option("--json", "Emit a machine-readable result on stdout")
            .action((type: string, name: string, options: GenerateOptions) =>
                this.run(type, name, options).catch(error => fail(error, options.json)));
    }

    private async run(type: string, name: string, options: GenerateOptions): Promise<void> {
        const artifactType = assertArtifactType(type);
        const files = artifactFiles(artifactType, name);
        const result = writeFiles(this.workdir, files, {
            force: options.force,
            dryRun: options.dryRun,
        });

        const payload = {
            schemaVersion: CLI_JSON_SCHEMA_VERSION,
            status: options.dryRun ? "planned" : "generated",
            type: artifactType,
            name,
            files: result.files,
        };

        if (options.json) {
            print(payload, true);
            return;
        }

        if (options.dryRun) {
            print(`Would generate ${payload.files.length} file(s):`);
            for (const file of payload.files) print(`  - ${file}`);
            return;
        }

        print(`Generated ${artifactType} "${name}":`);
        for (const file of payload.files) print(`  - ${file}`);
    }
}
