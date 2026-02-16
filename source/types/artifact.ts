export interface ArtifactEntry {
    id: string;
    timestamp: Date;
    size: number;
}

export type ArtifactDecoratorHandler = () => void;

export interface ArtifactDecorator {
    syntax: RegExp;
    handler: ArtifactDecoratorHandler;
}

export interface ArtifactOptions {
    readonly artifact: string;
    readonly provider: string;
    readonly decorator: ArtifactDecorator;
    verbose?: boolean;
}

export interface ArtifactInterface {
    readonly options: ArtifactOptions;
    readonly directory: string;
    readonly file: string;
    readonly workdir: string;

    get files(): string[];

    get extensions(): string[];

    scan(): string[];

    generate(): boolean;
}

export interface ArtifactEntry {
    vendor: string;
    decorator: string;
    pattern: string;
}