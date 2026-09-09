import {HttpStatus} from "../framework/enums/http-status.enum.ts";
import {ParseableEntriesType, ParseableType} from "./parseable.ts";

export interface HttpResponseBaseInterface {
    message: string;
    statusCode?: HttpStatus;
}

export interface ErrorResponseInterface {
    id: string;
    message?: string;
    code?: string;
    statusCode?: HttpStatus;
    error?: Error
}

export interface HttpResponseInterface<T extends ParseableType> extends ParseableEntriesType {
    statusCode: number,
    message?: string,
    data?: T,
    error?: any,
    errorStack?: Error | ErrorResponseInterface[];
}
