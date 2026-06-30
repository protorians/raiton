import type {MiddlewareParametersInterface, PluginInterface} from "../../types";
import {Router} from "../../core/router/router";
import {RaitonConfig} from "../../core/config/index";
import type {Route} from "../../core/router/route";
import type {RouteMetaInterface, ControllerMetaInterface} from "../../types";
import type {ParamMetaInterface} from "../../types";
import {METADATA_KEYS, Parametrable} from "../../framework";
import type {ContextInterface} from "../../types/core";
import type {RuntimeReplyInterface} from "../../types/runtime";
import {PluginScope} from "../../core";
import {Logger} from "@protorians/logger";

/**
 * OpenAPI plugin options
 */
export interface OpenApiOptions {
    /**
     * The base route for the documentation UI (e.g., '/docs')
     * @default '/docs'
     */
    route?: string;

    /**
     * The HTML string page
     */
    ui?: (config: Omit<OpenApiOptions, 'ui'>, context: ContextInterface) => string;

    /**
     * The endpoint for the raw JSON OpenAPI spec (e.g., '/docs/json')
     * If set to false, disables the JSON endpoint.
     * @default '/docs/json'
     */
    endpoint?: string | false;
    /**
     * Title of the API
     * @default 'API'
     */
    title?: string;
    /**
     * Version of the API
     * @default '1.0.0'
     */
    version?: string;
    /**
     * Description of the API
     * @default ''
     */
    description?: string;
    /**
     * Terms of service URL
     */
    termsOfService?: string;
    /**
     * Contact information
     */
    contact?: {
        name?: string;
        url?: string;
        email?: string;
    };
    /**
     * License information
     */
    license?: {
        name?: string;
        url?: string;
    };
}

export function openApiPlugin(options: OpenApiOptions = {}): PluginInterface {
    const opts = {
        endpoint: '/docs/json',
        title: 'API',
        version: '1.0.0',
        description: '',
        termsOfService: undefined,
        contact: undefined,
        license: undefined,
        ...options
    };

    return {
        name: 'openapi-plugin',
        setup: (scope: PluginScope) => {

            if (opts.route && opts.ui) {
                scope.get(opts.route, async ({reply, req, ...context}: ContextInterface) => {
                    const optionsWithoutUi = {...opts, ui: undefined}
                    const html = opts.ui?.(optionsWithoutUi, {reply, req, ...context});
                    reply.type('text/html');
                    reply.send(html || 'No Ui function defined');
                });
            }

            Logger.debug('openApiPlugin::scope', opts.endpoint)

            if (opts.endpoint) {
                scope.get(opts.endpoint, async ({reply}: ContextInterface) => {
                    const spec = await generateOpenApiSpec(scope, opts);
                    reply.type('application/json');
                    return spec
                });
            }
        }
    };
}

/**
 * Generate the OpenAPI specification object
 */
async function generateOpenApiSpec(scope: PluginScope, opts: OpenApiOptions): Promise<any> {
    // Load application config from RaitonConfig singleton
    // Ensure config is synced with current working directory (set by Application)
    await RaitonConfig.sync(process.cwd());

    const config: Map<keyof any, any> = RaitonConfig.current as any;

    // Build base URL
    const protocole = (config.get('protocole') as string) ?? 'http';
    const hostname = (config.get('hostname') as string) ?? 'localhost';
    const port = config.get('port') as number;
    const pathname = (config.get('pathname') as string) ?? '/';
    const basePath = pathname.endsWith('/') ? pathname : pathname + '/';

    let baseUrl = `${protocole}://${hostname}`;
    if (port !== undefined && port !== null) {
        baseUrl += `:${port}`;
    }
    baseUrl += basePath;

    // Initialize OpenAPI document
    const spec: any = {
        openapi: '3.0.0',
        info: {
            title: opts.title,
            version: opts.version,
            description: opts.description,
            ...(opts.termsOfService ? {termsOfService: opts.termsOfService} : {}),
            ...(opts.contact ? {contact: opts.contact} : {}),
            ...(opts.license ? {license: opts.license} : {})
        },
        servers: [
            {
                url: baseUrl
            }
        ],
        paths: {}
    };

    const routes = scope.router.getRoutes();

    for (const route of routes) {
        const handler = route.handler as any;
        const meta = handler._raitonMeta as {
            routeMeta: { method: string; path: string; propertyKey: string };
            controllerMeta: any;
            controllerClass: any
        } | undefined;
        if (!meta) {
            continue;
        }

        const {routeMeta, controllerMeta, controllerClass} = meta;
        const method = routeMeta.method.toLowerCase() as keyof any;

        let path = route.path;
        if (route.version) {
            path = `/${route.version}${path}`;
        }
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        if (!spec.paths[path]) {
            spec.paths[path] = {};
        }

        const operation: any = {
            parameters: [],
            responses: {}
        };

        const operationMetadata = Reflect.getMetadata(METADATA_KEYS.API_OPERATION, controllerClass, routeMeta.propertyKey);
        if (operationMetadata) {
            Object.assign(operation, operationMetadata);
        }

        const methodTags = Reflect.getMetadata(METADATA_KEYS.API_TAGS, controllerClass, routeMeta.propertyKey);
        if (methodTags) {
            operation.tags = methodTags;
        }

        const methodSecurity = Reflect.getMetadata(METADATA_KEYS.API_SECURITY, controllerClass, routeMeta.propertyKey);
        if (methodSecurity) {
            operation.security = methodSecurity;
        }

        const classTags = Reflect.getMetadata(METADATA_KEYS.API_TAGS, controllerClass);
        if (classTags) {
            operation.tags = [...(operation.tags || []), ...classTags];
        }

        const classSecurity = Reflect.getMetadata(METADATA_KEYS.API_SECURITY, controllerClass);
        if (classSecurity) {
            operation.security = [...(operation.security || []), ...classSecurity];
        }

        const params: ParamMetaInterface[] = Reflect.getMetadata(METADATA_KEYS.ROUTE_PARAMETERS, controllerClass)?.[routeMeta.propertyKey] || [];

        let bodyParam: ParamMetaInterface | undefined;
        const otherParams = params.filter(p => {
            if (p.type === Parametrable.BODY) {
                bodyParam = p;
                return false;
            }
            return true;
        });

        const apiParameters = Reflect.getMetadata(METADATA_KEYS.API_PARAMETERS, controllerClass)?.[routeMeta.propertyKey] || [];
        for (const param of apiParameters) {
            let inLocation: string;
            switch (param.in) {
                case 'path':
                    inLocation = 'path';
                    break;
                case 'query':
                    inLocation = 'query';
                    break;
                case 'header':
                    inLocation = 'header';
                    break;
                case 'cookie':
                    inLocation = 'cookie';
                    break;
                default:
                    continue; // Skip unknown locations
            }

            const paramObj: any = {
                name: param.name,
                in: inLocation,
                description: param.description,
                required: param.required ?? true,
                schema: {
                    type: 'string'
                }
            };

            if (param.type) {
                const typeName = typeof param.type === 'function' ? param.type.name : typeof param.type;
                let schemaType = 'string'; // default

                if (typeof param.type === 'function' && param.type.name) {
                    switch (param.type.name) {
                        case 'String':
                            schemaType = 'string';
                            break;
                        case 'Number':
                            schemaType = 'number';
                            break;
                        case 'Boolean':
                            schemaType = 'boolean';
                            break;
                        case 'Object':
                            schemaType = 'object';
                            break;
                        case 'Array':
                            schemaType = 'array';
                            break;
                        default:
                            // For custom classes, treat as object
                            schemaType = 'object';
                            break;
                    }
                } else if (typeof param.type === 'string') {
                    switch (param.type.toLowerCase()) {
                        case 'string':
                            schemaType = 'string';
                            break;
                        case 'number':
                        case 'int':
                        case 'float':
                        case 'double':
                            schemaType = 'number';
                            break;
                        case 'boolean':
                            schemaType = 'boolean';
                            break;
                        case 'object':
                            schemaType = 'object';
                            break;
                        case 'array':
                            schemaType = 'array';
                            break;
                        default:
                            schemaType = 'string'; // fallback
                            break;
                    }
                }

                paramObj.schema = {
                    type: schemaType,
                    ...(param.default !== undefined ? {default: param.default} : {})
                };

                // Handle array items if needed (simplified)
                if (schemaType === 'array' && param.type && typeof param.type === 'function' && param.type.name) {
                    switch (param.type.name) {
                        case 'String':
                            paramObj.schema.items = {type: 'string'};
                            break;
                        case 'Number':
                            paramObj.schema.items = {type: 'number'};
                            break;
                        case 'Boolean':
                            paramObj.schema.items = {type: 'boolean'};
                            break;
                        default:
                            paramObj.schema.items = {type: 'string'}; // generic
                            break;
                    }
                }
            }

            operation.parameters.push(paramObj);
        }

        // Process standard Parametrable decorators (@Param, @Query, etc.)
        for (const p of otherParams) {
            let inLocation: string | undefined;
            switch (p.type) {
                case Parametrable.PARAM:
                    inLocation = 'path';
                    break;
                case Parametrable.QUERY:
                    inLocation = 'query';
                    break;
                case Parametrable.HEADER:
                    inLocation = 'header';
                    break;
                // Note: COOKIE is not supported as there is no Parametrable.COOKIE in the framework
                default:
                    continue;
            }
            if (!inLocation) continue;

            const paramObj: any = {
                name: p.key ?? '',
                in: inLocation,
                required: true, // We don't have info about required; assume true
                schema: {
                    type: 'string' // Default to string; we could try to infer from p.metatype
                }
            };
            // Try to improve schema based on metatype if available
            if (p.metatype) {
                // If metatype is a constructor like String, Number, Boolean, we can map to JSON types
                const typeName = p.metatype.name;
                switch (typeName) {
                    case 'String':
                        paramObj.schema.type = 'string';
                        break;
                    case 'Number':
                        paramObj.schema.type = 'number';
                        break;
                    case 'Boolean':
                        paramObj.schema.type = 'boolean';
                        break;
                    case 'Object':
                        paramObj.schema.type = 'object';
                        break;
                    case 'Array':
                        paramObj.schema.type = 'array';
                        // We don't know item type; leave as generic
                        break;
                    default:
                        // For custom classes (DTOs), we could generate a schema but skip for simplicity
                        // Keep as string for now
                        break;
                }
            }
            operation.parameters.push(paramObj);
        }

        // Check for explicit API request body decorator
        const apiRequestBody = Reflect.getMetadata(METADATA_KEYS.API_REQUEST_BODY, controllerClass, routeMeta.propertyKey);
        if (apiRequestBody) {
            // Use explicit API request body definition
            const bodyRequired = apiRequestBody.required ?? true;
            let bodySchema = null;
            if (apiRequestBody.type) {
                bodySchema = getSchemaFromType(apiRequestBody.type);
            }
            if (bodySchema !== null) {
                operation.requestBody = {
                    required: bodyRequired,
                    content: {
                        'application/json': {
                            schema: bodySchema
                        }
                    }
                };
            }
        } else if (bodyParam) {
            // Fallback to automatic body parameter detection
            // Determine if the body param has a metatype that is a class (DTO)
            let bodySchema: any = {type: 'object'}; // default
            if (bodyParam.metatype && typeof bodyParam.metatype === 'function' && 'prototype' in bodyParam.metatype) {
                // It's a class; we treat it as object for simplicity
                bodySchema = {type: 'object'};
            } else {
                // If metatype is a primitive type like String, Number, Boolean, etc.
                const typeName = bodyParam.metatype?.name;
                switch (typeName) {
                    case 'String':
                        bodySchema = {type: 'string'};
                        break;
                    case 'Number':
                        bodySchema = {type: 'number'};
                        break;
                    case 'Boolean':
                        bodySchema = {type: 'boolean'};
                        break;
                    case 'Object':
                        bodySchema = {type: 'object'};
                        break;
                    case 'Array':
                        bodySchema = {type: 'array', items: {type: 'string'}}; // generic
                        break;
                    default:
                        bodySchema = {type: 'object'};
                }
            }
            operation.requestBody = {
                required: true,
                content: {
                    'application/json': {
                        schema: bodySchema
                    }
                }
            };
        }

        // Check for API response decorators first
        const apiResponses = Reflect.getMetadata(METADATA_KEYS.API_RESPONSES, controllerClass)?.[routeMeta.propertyKey] || [];

        if (apiResponses.length > 0) {
            // Use decorator-defined responses
            for (const response of apiResponses) {
                const statusCode = String(response.status);
                let responseContent = undefined;

                if (response.type) {
                    const responseSchema = getSchemaFromType(response.type);
                    if (response.isArray) {
                        responseContent = {
                            type: 'array',
                            items: responseSchema
                        };
                    } else {
                        responseContent = responseSchema;
                    }
                }

                operation.responses[statusCode] = {
                    description: response.description || '',
                    ...(responseContent ? {content: {'application/json': {schema: responseContent}}} : {})
                };
            }
        } else {
            // Fallback to return type detection
            const returnType = Reflect.getMetadata('design:returntype', controllerClass, routeMeta.propertyKey);
            if (returnType) {
                // Handle Promise<T> -> T
                let resolvedType = returnType;
                if (typeof returnType === 'function' && returnType.name === 'Promise' && !('length' in (returnType.prototype || {}))) {
                    // We can't easily get the generic argument; we'll try to infer from the type string
                    // For simplicity, if it's a Promise, we'll still treat the resolved type as unknown.
                    // In practice, we could attempt to get the type argument, but it's complex.
                    // We'll leave it as object for now.
                    resolvedType = Object;
                }
                const responseSchema = getSchemaFromType(resolvedType);
                operation.responses['200'] = {
                    description: 'Successful response',
                    ...(responseSchema ? {content: {'application/json': {schema: responseSchema}}} : {})
                };
            } else {
                // Default response if we cannot determine return type
                operation.responses['200'] = {
                    description: 'Successful response'
                };
            }
        }

        // Assign operation to path item under the method key
        (spec.paths[path] as any)[method] = operation;
    }

    return spec;
}

/**
 * Attempt to derive a JSON Schema fragment from a TypeScript type.
 * This is a simplified implementation; for production use, consider using
 * a library like @sinclair/typebox or class-transformer to generate schemas.
 */
function getSchemaFromType(type: any): any {
    if (typeof type !== 'function') {
        // Not a constructor; fallback to basic type detection
        return getPrimitiveTypeSchema(typeof type);
    }

    const typeName = type.name;
    switch (typeName) {
        case 'String':
            return {type: 'string'};
        case 'Number':
            return {type: 'number'};
        case 'Boolean':
            return {type: 'boolean'};
        case 'Object':
            return {type: 'object'};
        case 'Array':
            return {
                type: 'array',
                items: {type: 'string'} // We don't know the item type
            };
        case 'Date':
            return {
                type: 'string',
                format: 'date-time'
            };
        default:
            // For custom classes (DTOs, entities, etc.), we treat as object.
            // In a more advanced implementation, we could inspect the class properties
            // and generate properties from them (especially if decorated with @ApiProperty etc.)
            return {type: 'object'};
    }
}

/**
 * Get schema for primitive types (string, number, boolean, bigint, symbol, undefined, object, function)
 */
function getPrimitiveTypeSchema(primitive: string): any {
    switch (primitive) {
        case 'string':
            return {type: 'string'};
        case 'number':
            return {type: 'number'};
        case 'boolean':
            return {type: 'boolean'};
        case 'bigint':
            return {type: 'string'}; // Represent bigint as string in JSON
        case 'undefined':
            return {type: 'null'};
        case 'object':
            return {type: 'object'};
        case 'function':
            return {type: 'string'}; // functions are not serializable; represent as string placeholder
        default:
            return {type: 'string'};
    }
}

/**
 * Generate HTML for Swagger UI using CDN
 */
// function generateHtml(title: string, endpoint: string): string {
//     // Ensure endpoint starts with / if not already
//     if (!endpoint.startsWith('/')) {
//         endpoint = '/' + endpoint;
//     }
//     return `<!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <title>${title} - SwaggerUI</title>
//     <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
// </head>
// <body>
//     <div id="swagger-ui"></div>
//     <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
//     <script>
//         window.onload = () => {
//             window.ui = SwaggerUIBundle({
//                 url: '${endpoint}',
//                 domId: '#swagger-ui',
//                 presets: [
//                     SwaggerUIBundle.presets.forApis,
//                     SwaggerUIBundle.SwaggerUIStandalonePreset
//                 ],
//                 layout: "BaseLayout"
//             });
//         }
//     </script>
// </body>
// </html>`;
// }