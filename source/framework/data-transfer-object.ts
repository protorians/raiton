import type {ValidationError} from "class-validator";
import {loadClassValidator} from "./utilities/validation.util.ts";


export class DataTransferObject {
    constructor(initial?: Record<string, any>) {
        // `?? {}` : un corps absent (POST sans payload) donne un DTO vide plutôt
        // qu'un `TypeError` sur `Object.entries(undefined)`.
        for (const [key, value] of Object.entries(initial ?? {})) {
            if (typeof value !== 'function') this[key as keyof typeof this] = value;
        }
    }

    async validation(strict: boolean = true): Promise<void | ValidationError[]> {
        const {validate, validateOrReject} = await loadClassValidator()
        return await ((strict ? validateOrReject : validate)(this))
    }
}
