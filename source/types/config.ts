import type {ArtifactsConfigInterface} from "./artifact.ts";

export interface ConfigurableInterface {
    rootDir: string;
    version: string;
    artifacts?: ArtifactsConfigInterface
}