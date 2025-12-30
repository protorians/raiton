import type {BuildContext, BuildOptions, Metafile} from "esbuild";
import {HmrInterface} from "@/types/hmr";
import {ISignalStack} from "@protorians/core";

export interface BuildCommandOptions {
    develop?: boolean;
    bootstrap?: boolean;
}

export interface BuilderConfig {
    development?: boolean;
}

export type BuilderBootCallable = (builder: BuilderInterface) => Promise<void>

export interface BuilderInterface {
    readonly workdir: string;
    readonly options: BuilderConfig;
    readonly hmr: HmrInterface;
    // readonly signal: ISignalStack<BuilderSignalMap>;

    get context(): BuildContext<BuildOptions> | null;

    get source(): string | null;

    get out(): string | null;

    get bootstrapper(): string | null;

    get bootstrapperIndex(): string | null;

    get baseConfig(): BuildOptions;

    prepare(): Promise<this>;

    boot(): Promise<any>;

    start(callable?: BuilderBootCallable): Promise<this>;
}


export interface BuilderHMRDeclaration {
    filename: string;
    timestamp?: number;
    version?: number;
}
