import type {IHttpResponse, ParseableType, ResponseParameters} from "@/types";
import {RequestContext} from "@/core/context";

export function httpResponse<T extends ParseableType>(
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

export function successResponse<T extends ParseableType>(
    message?: string,
    data?: T,
    error?: any,
): IHttpResponse<T> {
    return httpResponse<T>(200, message, data, error);
}

export function errorResponse<T extends ParseableType>(
    message?: string,
    data?: T,
    error?: any,
): IHttpResponse<T> {
    return httpResponse<T>(500, message, data, error);
}


export class RaitonResponse {
    constructor(
        public readonly parameters: ResponseParameters,
        public readonly context: RequestContext,
    ) {
    }

    parse(){

    }
}