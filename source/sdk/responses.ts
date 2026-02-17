import type {IHttpResponse, IParseableEntry} from "@/types";

export function httpResponse<T extends IParseableEntry>(
    statusCode: number,
    message?: string,
    data?: T,
    error?: any,
): IHttpResponse<T> {
    return {
        statusCode,
        message,
        data,
        error,
    }
}

export function successResponse<T extends IParseableEntry>(
    message?: string,
    data?: T,
    error?: any,
): IHttpResponse<T> {
    return httpResponse<T>(200, message, data, error);
}

export function errorResponse<T extends IParseableEntry>(
    message?: string,
    data?: T,
    error?: any,
): IHttpResponse<T> {
    return httpResponse<T>(500, message, data, error);
}
