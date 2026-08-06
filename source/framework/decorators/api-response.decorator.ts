import "reflect-metadata";
import {METADATA_KEYS} from "../constants/decorators.constant";

/**
 * Response definition for OpenAPI
 */
export interface ApiResponseOptions {
    /**
     * HTTP status code
     */
    status: number;

    /**
     * Description of the response
     */
    description?: string;

    /**
     * Type/schema of the response (optional)
     */
    type?: any;

    /**
     * Whether this is the default response
     */
    isArray?: boolean;
}

/**
 * Decorator to add API response metadata to a route handler
 * @param options Response options (status, description, type, etc.)
 */
export function ApiResponse(options: ApiResponseOptions) {
    return function (target: any, propertyKey: string | symbol) {
        const responses = Reflect.getOwnMetadata(METADATA_KEYS.API_RESPONSES, target) || {};
        const methodResponses = responses[propertyKey] ? [...responses[propertyKey]] : [];
        methodResponses.push(options);
        responses[propertyKey] = methodResponses;
        Reflect.defineMetadata(METADATA_KEYS.API_RESPONSES, responses, target);
    };
}

/**
 * Shorthand decorator for 200 OK response
 * @param description Response description
 * @param type Response type (optional)
 * @param isArray Whether the response is an array (optional)
 */
export function ApiOkResponse(description?: string, type?: any, isArray?: boolean) {
    return ApiResponse({
        status: 200,
        description,
        type,
        isArray
    });
}

/**
 * Shorthand decorator for 201 Created response
 * @param description Response description
 * @param type Response type (optional)
 * @param isArray Whether the response is an array (optional)
 */
export function ApiCreatedResponse(description?: string, type?: any, isArray?: boolean) {
    return ApiResponse({
        status: 201,
        description,
        type,
        isArray
    });
}

/**
 * Shorthand decorator for 400 Bad Request response
 * @param description Response description
 */
export function ApiBadRequestResponse(description?: string) {
    return ApiResponse({
        status: 400,
        description
    });
}

/**
 * Shorthand decorator for 401 Unauthorized response
 * @param description Response description
 */
export function ApiUnauthorizedResponse(description?: string) {
    return ApiResponse({
        status: 401,
        description
    });
}

/**
 * Shorthand decorator for 403 Forbidden response
 * @param description Response description
 */
export function ApiForbiddenResponse(description?: string) {
    return ApiResponse({
        status: 403,
        description
    });
}

/**
 * Shorthand decorator for 404 Not Found response
 * @param description Response description
 */
export function ApiNotFoundResponse(description?: string) {
    return ApiResponse({
        status: 404,
        description
    });
}

/**
 * Shorthand decorator for 500 Internal Server Error response
 * @param description Response description
 */
export function ApiInternalServerErrorResponse(description?: string) {
    return ApiResponse({
        status: 500,
        description
    });
}