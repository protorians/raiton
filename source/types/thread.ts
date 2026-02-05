import {BuilderInterface} from "@/types/builder";
import {RuntimeAdapter} from "@/types/runtime";
import {ApplicationInterface} from "@/types/application";
import {RuntimeType} from "@/sdk/enums/runtime.enum";

export interface ThreadSetupOptions {
    application: ApplicationInterface;
    runtime?: RuntimeType
}

export type ThreadWaitCallable = () => (boolean | Promise<boolean>)

export interface ThreadInterface {
    readonly appDir: string;
    readonly builder: BuilderInterface;

    setup(options: ThreadSetupOptions): this

    run(): Promise<this>;

    restart(): void;

    stop(): void;

    sleep(milliseconds: number): Promise<unknown>;

    wait(condition: ThreadWaitCallable): Promise<void>;
}


export interface ThreadOptions{}