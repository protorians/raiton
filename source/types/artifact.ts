export interface ArtifactEntry {
    id: string;
    timestamp: Date;
    size: number;
}

export interface ArtifactsConfigInterface {
    types: string[]
    /**
     * Bridge file location, relative to the workdir or the rootDir.
     * `false` disables bridge discovery entirely.
     * @default "artifacts.bridge.ts" in the rootDir
     */
    bridge?: string | false
    /**
     * Discover direct dependencies that declare `package.json#raiton.artifacts`.
     * @default true
     */
    packages?: boolean
    /**
     * Optional allowlist of self-describing packages. When provided, only these
     * direct dependencies are considered.
     */
    packageAllowlist?: string[]
}

// export type ArtifactDecoratorHandler = () => void;

// export interface ArtifactDecorator {
//     syntax: RegExp;
//     handler: ArtifactDecoratorHandler;
// }

// export interface ArtifactOptions {
//     readonly artifact: string;
//     readonly provider: string;
//     readonly decorator: ArtifactDecorator;
//     verbose?: boolean;
// }

// export interface ArtifactInterface {
//     readonly options: ArtifactOptions;
//     readonly directory: string;
//     readonly file: string;
//     readonly workdir: string;
//
//     get files(): string[];
//
//     get extensions(): string[];
//
//     scan(): string[];
//
//     generate(): boolean;
// }

// export interface ArtifactEntry {
//     vendor: string;
//     decorator: string;
//     pattern: string;
// }