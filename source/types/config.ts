import type {ArtifactsConfig} from "./artifact";

export interface Configurable {
    rootDir: string;
    version: string;
    artifacts?: ArtifactsConfig
}