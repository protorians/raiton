import type {HttpResponseInterface} from "../../types/responses.ts";
import type {HttpStatus} from "../enums/http-status.enum.ts";
import {Raiton} from "../../core/raiton.ts";


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
