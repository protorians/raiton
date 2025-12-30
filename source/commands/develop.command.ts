import {Raiton, RaitonCommand} from "@/core";
import {ChildProcess, spawn} from 'node:child_process';
import {Logger} from "@protorians/logger";
import {EventMessageEnum} from "@/sdk";

export default class DevelopCommand extends RaitonCommand {
    public readonly name: string = 'develop';
    public readonly description: string = 'Run the application in development mode';

    private child: ChildProcess | null = null;

    public register(): void {
        this.cli
            .command(this.name)
            .alias("dev")
            .description("Start the application in development mode")
            .action(this.run.bind(this));
    }

    protected async restart(): Promise<void> {
        Logger.info('Reloading...');
        console.clear();
        this.child?.kill('SIGTERM');
        this.child?.on('exit', () => this.run());
    }

    protected async run(): Promise<void> {
        this.child = spawn(Raiton.identifier, ['build', '-d'], {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            cwd: this.workdir
        });

        this.child.on('message', (msg) => {
            if (msg === EventMessageEnum.RESTART) this.restart()
        });

        Logger.log('PID', this.child.pid)
    }
}