import type {ArtifactsConfigInterface} from "./artifact";

export interface ConfigurableInterface {
    rootDir: string;
    version: string;
    artifacts?: ArtifactsConfigInterface
}