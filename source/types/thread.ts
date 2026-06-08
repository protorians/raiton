import {BuilderInterface} from "./builder";
import {RuntimeAdapterInterface} from "./runtime";
import {ApplicationInterface} from "./application";
import {RuntimeType} from "../sdk/enums/runtime.enum";

export interface ThreadSetupOptionsInterface {
    application: ApplicationInterface;
    runtime?: RuntimeType
}

export type ThreadWaitCallable = () => (boolean | Promise<boolean>)

export interface ThreadInterface {
    readonly appDir: string;
    readonly builder: BuilderInterface;

    setup(options: ThreadSetupOptionsInterface): this

    run(): Promise<this>;

    restart(): void;

    stop(): void;

    sleep(milliseconds: number): Promise<unknown>;

    wait(condition: ThreadWaitCallable): Promise<void>;
}


export interface ThreadOptionsInterface {}