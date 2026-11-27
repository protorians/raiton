import {RaitonCommand, RaitonBuilder} from "../core/index.ts";
import {LBadge, Logger} from "@protorians/logger";
import type {BuildCommandOptionsInterface} from "../types/index.ts";
import {fail} from "../bin/cli-output.ts";


export default class BuildCommand extends RaitonCommand {
    public readonly name: string = 'build';
    public readonly description: string = 'Build the application';

    public register(): void {
        this.cli
            .command(this.name)
            .alias("b")
            .description("Build the application")
            .option("--develop, -d", "Build in development mode")
            .option("--bootstrap, -b", "Bootstrap the application")
            .action((options: BuildCommandOptionsInterface) =>
                this.run(options).catch(error => fail(error)));
    }

    protected async run(options: BuildCommandOptionsInterface): Promise<void> {
        if (options.develop) Logger.warn(LBadge.log("Dev Mode"),);

        const builder = new RaitonBuilder(this.workdir, {
            serve: options.develop,
            hmr: options.develop
        });

        await builder.prepare()
        await builder.boot()
        // await builder.start(async () => (options.develop || options.bootstrap) ? await builder.boot() : void (0))
    }
}
