import {RaitonCommand} from "@/core";
import {ChildProcess} from 'node:child_process';
import {Raiton} from "@/core/raiton";
import {CliTools} from "@/bin/cli-tools";
import path from "node:path";

export default class StartCommand extends RaitonCommand {
    public readonly name: string = 'start';
    public readonly description: string = 'Run the application in production mode';

    private child:  Bun.Subprocess<"ignore", "pipe", "inherit"> | ChildProcess | Deno.ChildProcess | null = null;

    public register(): void {
        this.cli
            .command(this.name)
            .alias("run")
            .description("Start the application in production mode")
            .action(this.run.bind(this));
    }

    protected async run(): Promise<void> {
        const entryPoint = path.join(this.appdir, 'bin/index.ts');
        this.child = CliTools.spawn(entryPoint, ['build', '--bootstrap'], {
            stdio: 'inherit',
            cwd: this.workdir
        });
    }
}