import type {ParseableEntriesType} from "@/types/parseable";

export interface ResponseParameters {
    readonly message?: string;
    readonly error?: boolean;
    readonly statusCode?: number;
    readonly errorStack?: Error;
    readonly data?: ParseableEntriesType
}

