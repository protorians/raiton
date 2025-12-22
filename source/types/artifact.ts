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
    artifact: string;
    provider: string;
    decorator: ArtifactDecorator;
    verbose?: boolean;
}

export interface ArtifactInterface {
    // readonly entries: Map<string, ArtifactEntry>;
    readonly options: ArtifactOptions;
    //
    // add(name: string, cacheableEntry: ArtifactEntry): this;
    //
    // remove(name: string): this;
    //
    // get(name: string): ArtifactEntry | undefined;
    //
    // reset(): this;
}