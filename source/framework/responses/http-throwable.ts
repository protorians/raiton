import {HttpResponseInterface} from "../../types";
import {HttpStatus} from "../enums";
import {Raiton} from "../../core";


export class ThrowableResponse extends Error {
    constructor(
        public input: string | HttpResponseInterface<any>,
        public statusCode: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
    ) {
        super(typeof input === 'string' ? input : input.message);
    }

    render() {
        const stack = typeof this.input === 'object' ? this.input.errorStack : undefined
        return {
            message: this.message,
            statusCode: this.statusCode,
            data: (typeof this.input === 'object') ? this.input.data : undefined,
            error: (typeof this.input === 'object') ? this.input.error : false,
            stack: stack instanceof Error ?
                (Raiton.thread?.builder?.options?.serve
                    ? this.stack?.split('\n').map(e => e.trim())
                    : undefined)
                : stack
        }
    }
}