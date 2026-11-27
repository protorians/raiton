/// <reference types="deno" />
import {RaitonBuilder, RaitonCommand} from "../core/index.ts";
import {ChildProcess} from 'node:child_process';
import {LBadge, Logger} from "@protorians/logger";
import {StartCommandOptionsInterface} from "../types/index.ts";
import {fail} from "../bin/cli-output.ts";

export default class StartCommand extends RaitonCommand {
    public readonly name: string = 'start';
    public readonly description: string = 'Run the application in production mode';

    private child: Bun.Subprocess<"ignore", "pipe", "inherit"> | ChildProcess | Deno.ChildProcess | null = null;

    public register(): void {
        this.cli
            .command(this.name)
            .alias("run")
            .description("Start the application in production mode")
            .option("--develop, -d", "Build in development mode")
            .action((options: StartCommandOptionsInterface) =>
                this.run(options).catch(error => fail(error)));
    }

    protected async run(options: StartCommandOptionsInterface): Promise<void> {
        if (options.develop) Logger.warn(LBadge.log("Dev Mode"),);

        const builder = new RaitonBuilder(this.workdir, {
            serve: true,
            hmr: options.develop
        });

        await builder.prepare()
        await builder.boot()
    }
}