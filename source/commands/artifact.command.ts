import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, fail, print} from "../bin/cli-output.ts";
import {RaitonConfig} from "../core/config/config.ts";
import {loadProject} from "../bin/project-utils.ts";
import {ArtifactRegistry} from "../core/bridge/registry.ts";

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
            .option("--dump", "Dump artifacts and their origin (scan or bridge)")
            .option("--json", "Emit a machine-readable list on stdout")
            .action((options: ArtifactOptions) => this.run(options).catch(error => fail(error, options.json)));
    }

    private async run(options: ArtifactOptions): Promise<void> {
        await RaitonConfig.sync(this.workdir, {force: true});
        const {manifest} = await loadProject(this.workdir, options.json);
        const artifacts = ArtifactRegistry.describeArtifacts(this.workdir);

        if (options.json) {
            print({
                schemaVersion: CLI_JSON_SCHEMA_VERSION,
                artifacts,
                types: manifest.artifacts,
                ...(manifest.bridge ? {bridge: manifest.bridge} : {}),
            }, true);
            return;
        }

        if (!artifacts.length) {
            print("No artifact detected. Use documented suffixes such as `.controller.ts` or declare entries in `artifacts.bridge.ts`.");
            return;
        }

        print(`Detected artifacts (${artifacts.length}):`);
        for (const artifact of artifacts) {
            const location = artifact.package
                ? `package ${artifact.package}`
                : (artifact.file ?? "");
            print(`  - ${artifact.name} [${artifact.kind}] origin=${artifact.origin}${location ? ` ${location}` : ""}`);
        }
        if (manifest.bridge) {
            print(`Bridge: ${manifest.bridge.file ?? "none"} (${manifest.bridge.artifacts.length} artifact(s), ${manifest.bridge.unresolved.length} unresolved)`);
        }
        print("Create one with `raiton generate <type> <name>` or declare it in `artifacts.bridge.ts`.");
    }
}
