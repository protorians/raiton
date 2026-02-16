import {ArtifactEntry} from "@/types/artifact";

export interface Configurable {
    rootDir: string;
    version: string;
    artifacts?: ArtifactEntry[]
}