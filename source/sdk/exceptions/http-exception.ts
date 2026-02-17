import {HttpStatus} from "@/sdk/enums/http-status.enum";
import {Raiton} from "@/core";
import {HttpResponseBaseInterface} from "@/types";

export class HttpException extends Error {

    constructor(
        error: string | HttpResponseBaseInterface | Error,
        public statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    ) {
        super(typeof error === 'string' ? error : error.message);
    }

    render() {
        return {
            message: this.message,
            statusCode: this.statusCode,
            error: true,
            stack: Raiton.thread?.builder?.options?.development
                ? this.stack?.split('\n').map(e => e.trim())
                : undefined
        }
    }

    toString() {
        return `HttpException: ${this.message} with status code ${this.statusCode}`
    }
}