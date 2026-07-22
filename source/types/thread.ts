import {BuilderInterface} from "./builder";
import {RuntimeAdapterInterface, RuntimeServerInterface} from "./runtime";
import {ApplicationInterface} from "./application";
import {RuntimeType} from "../framework/enums/runtime.enum";

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