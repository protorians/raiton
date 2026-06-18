import {ParseableEntriesType, ParseableType} from "./parseable";

export interface IHttpResponse<T extends ParseableType> extends ParseableEntriesType {
    statusCode: number,
    message?: string,
    data?: T,
    error?: any,
}
