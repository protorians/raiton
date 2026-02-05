import {Raiton, RaitonCommand} from "@/core";
import {ChildProcess} from 'node:child_process';
import {Logger} from "@protorians/logger";
import {EventMessageEnum} from "@/sdk";
import {CliHelpers} from "@/bin/cli-helpers";
import path from "node:path";

export default class DevelopCommand extends RaitonCommand {
    public readonly name: string = 'develop';
    public readonly description: string = 'Run the application in development mode';

    private child: Bun.Subprocess<"ignore", "pipe", "inherit"> | ChildProcess | null = null;

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

        if (this.child && 'on' in this.child)
            this.child?.on('exit', () => this.run());
    }

    protected async run(): Promise<void> {
        Logger.info('Workdir', this.workdir);

        const entryPoint = path.join(this.appdir, 'bin/index.ts');
        this.child = CliHelpers.spawn(entryPoint, ['build', '-d'], {
            stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
            cwd: this.workdir
        });

        if (this.child && 'on' in this.child)
            this.child.on('message', (msg) => {
                if (msg === EventMessageEnum.RESTART) this.restart()
            });

        Logger.log('PID', this.child.pid)
    }
}