import {HttpResponse, HttpStatus} from "../index.ts";
import {HttpResponseInterface} from "../../types/index.ts";
import {Raiton} from "../../core/index.ts";


export function RaitonResponses(
    message: string,
    data: any,
    // data: HttpResponseInterface<any> | null,
    statusCode: HttpStatus,
    metadata?: Omit<HttpResponseInterface<any>, 'data' | 'message' | 'statusCode'>
) {

    if (metadata) {
        if (metadata.error === undefined) {
            metadata.error = typeof data?.error === 'boolean' ? data?.error : false
        }
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