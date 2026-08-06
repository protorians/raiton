import "reflect-metadata";
import {METADATA_KEYS} from "../constants/decorators.constant";

/**
 * Tag metadata for OpenAPI grouping
 */
export interface ApiTagOptions {
    /**
     * Tag name
     */
    name: string;

    /**
     * Tag description (optional)
     */
    description?: string;

    /**
     * External documentation URL (optional)
     */
    externalDocs?: {
        description?: string;
        url: string;
    };
}

/**
 * Decorator to add API tags to a controller or method
 * @param tags Tag(s) to apply
 */
export function ApiTags(...tags: (string | ApiTagOptions)[]) {
    return function (target: any, propertyKey?: string | symbol) {
        // Convert string tags to objects
        const processedTags = tags.map(tag =>
            typeof tag === 'string' ? {name: tag} : tag
        );

        if (propertyKey) {
            // Method-level decorator
            const existingTags = Reflect.getOwnMetadata(METADATA_KEYS.API_TAGS, target, propertyKey) || [];
            Reflect.defineMetadata(METADATA_KEYS.API_TAGS, [...existingTags, ...processedTags], target, propertyKey);
        } else {
            // Class-level decorator
            const existingTags = Reflect.getOwnMetadata(METADATA_KEYS.API_TAGS, target) || [];
            Reflect.defineMetadata(METADATA_KEYS.API_TAGS, [...existingTags, ...processedTags], target);
        }
    };
}

/**
 * Operation metadata for OpenAPI
 */
export interface ApiOperationOptions {
    /**
     * Operation summary
     */
    summary?: string;

    /**
     * Operation description
     */
    description?: string;

    /**
     * Operation ID (unique identifier)
     */
    operationId?: string;

    /**
     * Whether the operation is deprecated
     */
    deprecated?: boolean;

    /**
     * External documentation
     */
    externalDocs?: {
        description?: string;
        url: string;
    };
}

/**
 * Decorator to add operation metadata to a method
 * @param options Operation options
 */
export function ApiOperation(options: ApiOperationOptions = {}) {
    return function (target: any, propertyKey: string | symbol) {
        const existing = Reflect.getMetadata(METADATA_KEYS.API_OPERATION, target, propertyKey) || {};
        Reflect.defineMetadata(METADATA_KEYS.API_OPERATION, {...existing, ...options}, target, propertyKey);
    };
}

/**
 * Security requirements for OpenAPI
 */
export interface ApiSecurityOptions {
    /**
     * Security scheme name
     */
    [key: string]: string[] | undefined;
}

/**
 * Decorator to add security requirements to a controller or method
 * @param security Security requirements (scheme name -> scopes[])
 */
export function ApiSecurity(...security: ApiSecurityOptions[]) {
    return function (target: any, propertyKey?: string | symbol) {
        if (propertyKey) {
            // Method-level decorator
            const methodSecurities = Reflect.getOwnMetadata(METADATA_KEYS.API_SECURITY, target, propertyKey) || [];
            Reflect.defineMetadata(METADATA_KEYS.API_SECURITY, [...methodSecurities, ...security], target, propertyKey);
        } else {
            // Class-level decorator
            const securities = Reflect.getOwnMetadata(METADATA_KEYS.API_SECURITY, target) || [];
            Reflect.defineMetadata(METADATA_KEYS.API_SECURITY, [...securities, ...security], target);
        }
    };
}

/**
 * Decorator to define request body for a method (alternative to using type detection)
 * @param type The type/schema of the request body
 * @param description Description of the request body (optional)
 * @param required Whether the request body is required (default: true)
 */
export function ApiBody(type: any, description?: string, required: boolean = true) {
    return function (target: any, propertyKey: string | symbol) {
        Reflect.defineMetadata(METADATA_KEYS.API_REQUEST_BODY, {
            type,
            description,
            required
        }, target, propertyKey);
    };
}

/**
 * Decorator to add additional parameters (complements Parametrable decorators)
 * @param name Parameter name
 * @param options Parameter options
 */
export function ApiParam(name: string, options: {
    /**
     * Parameter location (path, query, header, cookie)
     */
    in: 'path' | 'query' | 'header' | 'cookie';

    /**
     * Parameter description
     */
    description?: string;

    /**
     * Whether the parameter is required
     */
    required?: boolean;

    /**
     * Parameter type (for schema generation)
     */
    type?: any;

    /**
     * Default value (optional)
     */
    default?: any;

    /**
     * Whether this parameter should be excluded from documentation (deprecated)
     * @deprecated
     */
    deprecated?: boolean;

    /**
     * enums values (optional)
     */
    enum?: any[]
}) {
    return function (target: any, propertyKey: string | symbol) {
        const params = Reflect.getOwnMetadata(METADATA_KEYS.API_PARAMETERS, target, propertyKey) || {};
        const methodParams = params[propertyKey] ? [...params[propertyKey]] : [];
        methodParams.push({name, ...options});
        params[propertyKey] = methodParams;

        if (options.enum) {
            const enums = Reflect.getOwnMetadata(METADATA_KEYS.API_ENUMS, target) || {};
            enums[propertyKey] = options.enum;
            Reflect.defineMetadata(METADATA_KEYS.API_ENUMS, enums, target);
        }
        Reflect.defineMetadata(METADATA_KEYS.API_PARAMETERS, params, target, propertyKey);
    };
}

/**
 * Decorator to define a property of a DTO for OpenAPI
 * @param options Property options
 */
export function ApiProperty(options: {
    type?: any;
    description?: string;
    example?: any;
    required?: boolean;
    enum?: any[];
    isArray?: boolean;
} = {}) {
    return function (target: any, propertyKey: string | symbol) {
        const properties = Reflect.getOwnMetadata(METADATA_KEYS.API_PROPERTY, target.constructor) || {};
        properties[propertyKey] = {
            ...options,
            // If type is not provided, try to infer it using design:type
            type: options.type || Reflect.getMetadata('design:type', target, propertyKey)
        };
        Reflect.defineMetadata(METADATA_KEYS.API_PROPERTY, properties, target.constructor);
    };
}

/**
 * Decorator to add query parameter metadata (shortcut for ApiParam with in: 'query')
 * @param name Parameter name
 * @param options Parameter options (description, required, type, default, deprecated)
 */
export function ApiQuery(name: string, options: {
    /**
     * Parameter description
     */
    description?: string;

    /**
     * Whether the parameter is required
     */
    required?: boolean;

    /**
     * Parameter type (for schema generation)
     */
    type?: any;

    /**
     * Default value (optional)
     */
    default?: any;

    /**
     * Whether this parameter should be excluded from documentation (deprecated)
     * @deprecated
     */
    deprecated?: boolean;

    /**
     * enums values (optional)
     */
    enum?: any[]
}) {
    return ApiParam(name, {...options, in: 'query'});
}
