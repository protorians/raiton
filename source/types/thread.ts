import type {BuilderInterface} from "./builder";
import {ServerInterface} from "./server";

export interface ThreadOptions {
    readonly builder: BuilderInterface;
}

export type ThreadWaitCallable = () => (boolean | Promise<boolean>)

export interface ThreadServerOptions {
    port?: number;
    prefix?: string;
}

export interface ThreadInterface extends ThreadOptions {
    readonly appDir: string;

    restart(): void;

    stop(): void;

    sleep(milliseconds: number): Promise<unknown>;

    wait(condition: ThreadWaitCallable): Promise<void>;

    createApplication(options?: ThreadServerOptions): Promise<ServerInterface>;
}