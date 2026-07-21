import {HttpStatus} from "../enums/http-status.enum";
import {Raiton} from "../../core";
import {HttpResponseBaseInterface} from "../../types";

export class HttpException extends Error {

    constructor(
        error: string | HttpResponseBaseInterface | Error,
        public statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
        public errorCode: number | string | symbol | undefined = undefined,
    ) {
        super(typeof error === 'string' ? error : error.message);
    }

    setStatus(statusCode: HttpStatus) {
        this.statusCode = statusCode;
        return this;
    }

    setErrorCode(code: number | string | symbol | undefined) {
        this.errorCode = code;
        return this;
    }

    setMessage(error: string | HttpResponseBaseInterface | Error) {
        this.message = typeof error === 'string' ? error : error.message;
        return this;
    }

    render() {
        return {
            message: this.message,
            statusCode: this.statusCode,
            errorCode: this.errorCode,
            error: true,
            stack: Raiton.thread?.builder?.options?.serve
                ? this.stack?.split('\n').map(e => e.trim())
                : undefined
        }
    }

    toString() {
        return `HttpException: ${this.message} with status code ${this.statusCode}`
    }
}