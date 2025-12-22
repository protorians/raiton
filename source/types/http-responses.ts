import {IParseableEntries, IParseableEntry} from "./parseable";

export interface IHttpResponse<T extends IParseableEntry> extends IParseableEntries {
    statusCode: number,
    message?: string,
    data?: T,
    error?: any,
}
