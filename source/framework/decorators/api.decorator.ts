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
        const tagsMetadata = Reflect.getMetadata(METADATA_KEYS.API_TAGS, target) || [];

        // Convert string tags to objects
        const processedTags = tags.map(tag =>
            typeof tag === 'string' ? { name: tag } : tag
        );

        if (propertyKey) {
            // Method-level decorator
            const methodTags = Reflect.getMetadata(METADATA_KEYS.API_TAGS, target, propertyKey) || [];
            Reflect.defineMetadata(METADATA_KEYS.API_TAGS, [...methodTags, ...processedTags], target, propertyKey);
        } else {
            // Class-level decorator
            Reflect.defineMetadata(METADATA_KEYS.API_TAGS, [...tagsMetadata, ...processedTags], target);
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
        const securities = Reflect.getMetadata(METADATA_KEYS.API_SECURITY, target) || [];

        if (propertyKey) {
            // Method-level decorator
            const methodSecurities = Reflect.getMetadata(METADATA_KEYS.API_SECURITY, target, propertyKey) || [];
            Reflect.defineMetadata(METADATA_KEYS.API_SECURITY, [...methodSecurities, ...security], target, propertyKey);
        } else {
            // Class-level decorator
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
}) {
    return function (target: any, propertyKey: string | symbol) {
        const params = Reflect.getMetadata(METADATA_KEYS.API_PARAMETERS, target) || {};
        if (!params[propertyKey]) {
            params[propertyKey] = [];
        }
        params[propertyKey].push({name, ...options});
        Reflect.defineMetadata(METADATA_KEYS.API_PARAMETERS, params, target, propertyKey);
    };
}