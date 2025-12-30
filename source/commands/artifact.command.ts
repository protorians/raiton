import {RaitonCommand, RaitonBuilder} from "@/core";
import {Logger} from "@protorians/logger";
import type {BuildCommandOptions} from "@/types";


export default class ArtifactCommand extends RaitonCommand {
    public readonly name: string = 'artifact';
    public readonly description: string = 'Manage artifacts';

    public register(): void {
        this.cli
            .command(this.name)
            .alias("art")
            .description(this.description)
            .option("--dump, -d", "Dump the application artifacts configured")
            .option("--create, -c", "Create an artifact")
            .option("--remove, -r", "Remove an artifact")
            .option("--clear", "Clear all artifacts")
            .action(this.run.bind(this));
    }

    protected async run(options: BuildCommandOptions): Promise<void> {

        Logger.notice("Artifact management is not yet implemented");
        Logger.debug('Options:', options, '')

    }
}