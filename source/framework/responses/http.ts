import {HttpResponseInterface} from "../../types";
import {HttpStatus} from "../enums";
import {ThrowableResponse} from ".";


export class HttpResponse {
    public static push(response: Partial<HttpResponseInterface<any>>): void {
        throw new ThrowableResponse({
            statusCode: response.statusCode || HttpStatus.BAD_REQUEST,
            message: response.message || 'No response message provided',
            data: response.data,
            error: response.error,
            errorStack: response.errorStack
        })
    }

    constructor(public readonly response: HttpResponseInterface<any>) {
    }

    status(statusCode: HttpStatus): this {
        this.response.statusCode = statusCode;
        return this;
    }

    message(message: string) {
        this.response.message = message;
        return this;
    }

    data(data: any) {
        this.response.data = data;
        return this;
    }

    error(error: boolean) {
        this.response.error = error;
        return this;
    }

    stack(stack: Error) {
        this.response.errorStack = stack
        return this;
    }

    render(): HttpResponseInterface<any> {
        return (new ThrowableResponse({...this.response})).render()
    }
}