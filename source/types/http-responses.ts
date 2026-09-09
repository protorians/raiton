import {ParseableEntriesType, ParseableType} from "./parseable.ts";

export interface IHttpResponse<T extends ParseableType> extends ParseableEntriesType {
    statusCode: number,
    message?: string,
    data?: T,
    error?: any,
}
