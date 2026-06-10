import {HttpResponse, HttpStatus} from "..";
import {HttpResponseInterface} from "../../types";
import {Raiton} from "../../core";


export function RaitonResponses(
    message: string,
    data: any,
    // data: HttpResponseInterface<any> | null,
    statusCode: HttpStatus,
    metadata?: Omit<HttpResponseInterface<any>, 'data' | 'message' | 'statusCode'>
) {

    if (metadata) {
        metadata.error = typeof data?.error === 'boolean' ? data?.error : false
        metadata.errorStack = (metadata.errorStack instanceof Error)
            ? metadata.errorStack
            : (Raiton.thread?.builder?.options?.serve
                ? (Array.isArray(metadata.errorStack) ? metadata.errorStack : [])
                : undefined)
    }

    return {
        ...metadata,
        statusCode,
        message,
        data,
    }
}