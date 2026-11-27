import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, fail, print} from "../bin/cli-output.ts";
import {RaitonConfig} from "../core/config/config.ts";
import {generateManifest} from "../manifest/manifest.ts";

interface ArtifactOptions {
    dump?: boolean;
    json?: boolean;
}

export default class ArtifactCommand extends RaitonCommand {
    public readonly name = "artifact";
    public readonly description = "Inspect artifacts detected in the project";

    public register(): void {
        this.cli
            .command("artifact")
            .alias("art")
            .description(this.description)
            .option("--dump", "Dump artifacts detected by the project scanner")
            .option("--json", "Emit a machine-readable list on stdout")
            .action((options: ArtifactOptions) => this.run(options).catch(error => fail(error, options.json)));
    }

    private async run(options: ArtifactOptions): Promise<void> {
        await RaitonConfig.sync(this.workdir, {force: true});
        const manifest = generateManifest({refresh: true, workdir: this.workdir});

        if (options.json) {
            print({schemaVersion: CLI_JSON_SCHEMA_VERSION, artifacts: manifest.artifacts, types: RaitonConfig.get("artifacts")?.types ?? []}, true);
            return;
        }

        if (!manifest.artifacts.length) {
            print("No artifact detected. Use documented suffixes such as `.controller.ts` or `.service.ts`.");
            return;
        }

        print(`Detected artifact types (${manifest.artifacts.length}):`);
        for (const artifact of manifest.artifacts) print(`  - ${artifact}`);
        print("Create one with `raiton generate <type> <name>`.");
    }
}
