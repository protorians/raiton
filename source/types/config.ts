import type {ArtifactsConfig} from "@/types/artifact";

export interface Configurable {
    rootDir: string;
    version: string;
    artifacts?: ArtifactsConfig
}