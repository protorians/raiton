import {BuilderInterface} from "./builder.ts";
import {RuntimeAdapterInterface, RuntimeServerInterface} from "./runtime.ts";
import {ApplicationInterface} from "./application.ts";
import {RuntimeType} from "../framework/enums/runtime.enum.ts";

export interface ThreadSetupOptionsInterface {
    application: ApplicationInterface;
    runtime?: RuntimeType
}

export type ThreadWaitCallable = () => (boolean | Promise<boolean>)

export interface ThreadInterface {
    readonly appDir: string;
    readonly builder: BuilderInterface;
    application: ApplicationInterface | null;
    runtime: RuntimeAdapterInterface | null;
    runtimeServer: RuntimeServerInterface | null;

    setup(options: ThreadSetupOptionsInterface): this

    run(): Promise<this>;

    restart(): void;

    stop(): void;

    sleep(milliseconds: number): Promise<unknown>;

    wait(condition: ThreadWaitCallable): Promise<void>;
}


export interface ThreadOptionsInterface {
    serve?: boolean;
}