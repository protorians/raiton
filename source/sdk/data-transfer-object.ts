import {validate, validateOrReject, ValidationError} from "class-validator";
import {Logger} from "@protorians/logger";


export class DataTransferObject {
    constructor(initial: Record<string, any>) {
        for (const [key, value] of Object.entries(initial)) {
            if (typeof value !== 'function') this[key as keyof typeof this] = value;
        }
    }

    async validation(strict: boolean = true): Promise<void | ValidationError[]> {
        return await ((strict ? validateOrReject : validate)(this))
    }
}