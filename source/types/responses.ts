import {HttpStatus} from "../sdk/enums/http-status.enum";
import {ParseableEntriesType, ParseableType} from "./parseable";

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
