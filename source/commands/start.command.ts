import {RaitonCommand} from "@/core";
import {ChildProcess, spawn} from 'node:child_process';
import {Raiton} from "@/core/raiton";

export default class StartCommand extends RaitonCommand {
    public readonly name: string = 'start';
    public readonly description: string = 'Run the application in production mode';

    private child: ChildProcess | null = null;

    public register(): void {
        this.cli
            .command("start")
            .alias("run")
            .description("Start the application in production mode")
            .action(this.run.bind(this));
    }

    protected async run(): Promise<void> {
        this.child = spawn(Raiton.identifier, ['build', '--bootstrap'], {
            stdio: 'inherit',
            cwd: this.workdir
        });
    }
}