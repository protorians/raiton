import {IPayload} from "@/types";
import {SYSTEM_DECORATORS_KEYS} from "@/sdk/constants";

/**
 * A decorator function that combines and assigns schema-related metadata
 * to a specific property in the target constructor using reflective metadata.
 *
 * @param {IPayload} payload - The schema-related payload to be merged and assigned as metadata.
 * @return {Function} A decorator function that applies the merged metadata to the property.
 */
export function Schemeable(payload: IPayload): (target: any, propertyKey: (string | symbol)) => void {
    return (target: any, propertyKey: string | symbol,) => {
        const current: IPayload = {...(Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.ROUTES_SCHEMES, target.constructor, propertyKey) || {}), ...payload};
        Reflect.defineMetadata(SYSTEM_DECORATORS_KEYS.ROUTES_SCHEMES, current, target.constructor, propertyKey);
    };
}


/**
 * Constructs a schematizable object for the provided payload body.
 *
 * @param {IPayload['body']} payload - The body of the payload to be schematized.
 * @return {object} Returns a schematized object containing the provided payload body.
 */
export function BodySchemeable(payload: IPayload['body']): (target: any, propertyKey: (string | symbol)) => void {
    return Schemeable({
        body: payload
    });
}

/**
 * Transforms the provided headers payload into a schematizable format.
 *
 * @param {IPayload['headers']} payload - The headers payload to be processed and transformed.
 * @return {object} The transformed schematizable object containing the headers.
 */
export function HeadersSchemeable(payload: IPayload['headers']): (target: any, propertyKey: (string | symbol)) => void {
    return Schemeable({
        headers: payload
    });
}

/**
 * Constructs a schematizable object using the given query string payload.
 *
 * @param {IPayload['querystring']} payload - The query string object to be included in the schematizable configuration.
 * @return {object} The resulting schematizable object containing the query string.
 */
export function QuerySchemeable(payload: IPayload['querystring']): (target: any, propertyKey: (string | symbol)) => void {
    return Schemeable({
        querystring: payload
    });
}

/**
 * Creates a schematizable object using the provided parameters.
 *
 * @param {IPayload['params']} payload - The parameters to be used for creating the schematizable object.
 * @return {Object} The resulting schematizable object containing the specified parameters.
 */
export function ParamsSchemeable(payload: IPayload['params']): (target: any, propertyKey: (string | symbol)) => void {
    return Schemeable({
        params: payload
    });
}

/**
 * Constructs a schematized response payload.
 *
 * @param {IPayload['response']} payload - The response payload to be schematized.
 * @return {object} The schematized response object.
 */
export function ResponseSchemeable(payload: IPayload['response']): (target: any, propertyKey: (string | symbol)) => void {
    return Schemeable({
        response: payload
    });
}