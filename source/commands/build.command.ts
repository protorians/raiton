// import "reflect-metadata"

import {RaitonCommand, RaitonBuilder} from "@/core";
import {Logger} from "@protorians/logger";
import type {BuildCommandOptions} from "@/types";


export default class BuildCommand extends RaitonCommand {
    public readonly name: string = 'build';
    public readonly description: string = 'Build the application';

    public register(): void {
        this.cli
            .command("build")
            .alias("b")
            .description("Build the application")
            .option("--develop, -d", "Build in development mode")
            .option("--bootstrap, -b", "Bootstrap the application")
            .action(this.run.bind(this));
    }

    protected async run(options: BuildCommandOptions): Promise<void> {
        if (options.develop) Logger.notice("Development mode is used");

        const builder = new RaitonBuilder(this.workdir, {
            development: options.develop
        });

        await builder.prepare()
        await builder.start(async () => (options.develop || options.bootstrap) ? await builder.boot() : void (0))
    }
}