import path from "node:path";
import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, fail, print} from "../bin/cli-output.ts";
import {loadProject} from "../bin/project-utils.ts";
import {generateClient} from "../manifest/client.ts";
import {writeFiles} from "../bin/file-utils.ts";

interface ClientOptions {
    out?: string;
    json?: boolean;
    name?: string;
    force?: boolean;
    dryRun?: boolean;
    baseUrl?: string;
}

export default class ClientCommand extends RaitonCommand {
    public readonly name = "client";
    public readonly description = "Generate a typed TypeScript client from the route contracts";

    public register(): void {
        this.cli
            .command("client")
            .description(this.description)
            .option("--out <directory>", "Output directory", "./sdk")
            .option("--name <name>", "Generated error/class prefix", "RaitonClient")
            .option("--base-url <url>", "Default base URL written in the client", "")
            .option("--force", "Overwrite an existing client")
            .option("--dry-run", "Print the file plan without writing")
            .option("--json", "Emit a machine-readable result on stdout")
            .action((options: ClientOptions) => this.run(options).catch(error => fail(error, options.json)));
    }

    private async run(options: ClientOptions): Promise<void> {
        const {manifest} = await loadProject(this.workdir, options.json);
        const content = generateClient(manifest, {
            name: options.name,
            baseUrl: options.baseUrl || undefined,
        });

        const outDir = options.out ?? "./sdk";
        const result = writeFiles(path.resolve(this.workdir, outDir), [
            {path: "index.ts", content},
        ], {
            force: options.force,
            dryRun: options.dryRun,
        });

        const payload = {
            schemaVersion: CLI_JSON_SCHEMA_VERSION,
            status: options.dryRun ? "planned" : "generated",
            output: path.resolve(this.workdir, outDir),
            routes: manifest.routes.length,
            files: result.files,
        };

        if (options.json) {
            print(payload, true);
            return;
        }

        print(`${options.dryRun ? "Would generate" : "Generated"} typed client (${manifest.routes.length} route(s)) in ${payload.output}`);
    }
}
