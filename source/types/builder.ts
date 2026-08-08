import {WatchEventType} from "node:fs";
import type {HmrChannel} from "../framework/artifacts";

export interface StartCommandOptionsInterface {
    develop?: boolean;
}

export interface BuildCommandOptionsInterface {
    develop?: boolean;
    bootstrap?: boolean;
}

export interface BuilderConfigInterface {
    serve?: boolean;
    hmr?: boolean;
}

export type BuilderBootCallableType = (builder: BuilderInterface) => Promise<void>

export interface BuilderInterface {
    readonly workdir: string;
    readonly options: BuilderConfigInterface;
    // readonly signal: ISignalStack<BuilderSignalMap>;

    // get context(): BuildContext<BuildOptions> | null;

    get source(): string | null;

    get out(): string | null;

    get bootstrapper(): string | null;

    get bootstrapperFile(): string | null;

    // get baseConfig(): BuildOptions;

    prepare(): Promise<this>;

    boot(): Promise<any>;

    // start(callable?: BuilderBootCallable): Promise<this>;
}


export interface BuilderHMRDeclarationInterface {
    filename: string;
    timestamp?: number;
    version?: number;
    type?: WatchEventType
    channel?: HmrChannel
    artifactType?: string
}
