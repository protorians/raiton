import {HttpStatus} from "@/sdk/enums/http-status.enum";

export interface HttpResponseBaseInterface {
    message: string;
    statusCode?: HttpStatus;
}

export interface HttpResponseInterface<T = any> extends HttpResponseBaseInterface{
    error?: boolean;
    errorStack?: Error | ErrorResponseInterface[];
    data?: T
}

export interface ErrorResponseInterface {
    id: string;
    message?: string;
    code?: string;
    statusCode?: HttpStatus;
    error?: Error
}
