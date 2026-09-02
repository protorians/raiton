import type {ParamMetaInterface} from "../../types";
import {METADATA_KEYS, Parametrable} from "../index";
import {PluginScope} from "../../core";
import {RaitonConfig} from "../../core/config";
import {getSocketRegistry} from "../../core/socket";
import {RaitonThread} from "../../core/thread";

/**
 * Generate the OpenAPI specification object
 */
export async function generateOpenApiSpec(scope: PluginScope, opts: any): Promise<any> {
    // Use application config directly (includes HTTPS, port, hostname)
    const appConfig = RaitonThread.current?.application?.config;
    const appHttps = RaitonThread.current?.application?.https;

    let protocole: string;
    let hostname: string;
    let port: number | undefined;
    let pathname: string;
    let prefix: string;

    if (appConfig) {
        protocole = appHttps?.enabled ? 'https' : (appConfig.protocole || 'http');
        hostname = appConfig.hostname || 'localhost';
        port = appConfig.port;
        pathname = appConfig.pathname || '/';
        prefix = appConfig.prefix || '';
    } else {
        // Fallback to RaitonConfig
        await RaitonConfig.sync(process.cwd());
        const config: Map<keyof any, any> = RaitonConfig.current as any;
        protocole = (config.get('protocole') as string) ?? 'http';
        hostname = (config.get('hostname') as string) ?? 'localhost';
        port = config.get('port') as number;
        pathname = (config.get('pathname') as string) ?? '/';
        prefix = (config.get('prefix') as string) ?? '';
    }
    const basePath = pathname.endsWith('/') ? pathname : pathname + '/';

    let baseUrl = `${protocole}://${hostname}`;
    if (port !== undefined && port !== null) {
        baseUrl += `:${port}`;
    }
    baseUrl += basePath;
    if (prefix) {
        baseUrl += prefix.startsWith('/') ? prefix.slice(1) : prefix;
        if (!baseUrl.endsWith('/')) baseUrl += '/';
    }

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

        const controllerPrototype = controllerClass?.prototype ?? controllerClass;

        const operationMetadata = Reflect.getMetadata(METADATA_KEYS.API_OPERATION, controllerPrototype, routeMeta.propertyKey);
        if (operationMetadata) {
            Object.assign(operation, operationMetadata);
        }

        const methodTags = Reflect.getMetadata(METADATA_KEYS.API_TAGS, controllerPrototype, routeMeta.propertyKey);
        if (methodTags) {
            operation.tags = methodTags;
        }

        const methodSecurity = Reflect.getMetadata(METADATA_KEYS.API_SECURITY, controllerPrototype, routeMeta.propertyKey);
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

        const params: ParamMetaInterface[] = Reflect.getMetadata(METADATA_KEYS.ROUTE_PARAMETERS, controllerPrototype)?.[routeMeta.propertyKey] || [];

        let bodyParam: ParamMetaInterface | undefined;
        const otherParams = params.filter(p => {
            if (p.type === Parametrable.BODY) {
                bodyParam = p;
                return false;
            }
            return true;
        });

        const apiParameters = Reflect.getMetadata(METADATA_KEYS.API_PARAMETERS, controllerPrototype, routeMeta.propertyKey)?.[routeMeta.propertyKey] || [];
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
                paramObj.schema = getSchemaFromType(param.type);
                if (param.default !== undefined) {
                    paramObj.schema.default = param.default;
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
        const apiRequestBody = Reflect.getMetadata(METADATA_KEYS.API_REQUEST_BODY, controllerPrototype, routeMeta.propertyKey);
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
            if (bodyParam.metatype) {
                bodySchema = getSchemaFromType(bodyParam.metatype);
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
        const apiResponses = Reflect.getMetadata(METADATA_KEYS.API_RESPONSES, controllerPrototype)?.[routeMeta.propertyKey] || [];

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
            const returnType = Reflect.getMetadata('design:returntype', controllerPrototype, routeMeta.propertyKey);
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

    // Document registered WebSocket sockets as POST operations (one per event)
    const sockets = getSocketRegistry();

    for (const [, socketEntry] of sockets) {
        const {namespace, construct, metadata} = socketEntry;
        const classTags = Reflect.getMetadata(METADATA_KEYS.API_TAGS, construct) || [];
        const socketPrototype = construct?.prototype ?? construct;

        for (const event of metadata.events) {
            if (event.type !== 'event' && event.type !== 'message') continue;
            if (!event.name) continue;

            const channelPath = `${namespace}`.replace(/\/+/g, '/') || '/';
            const eventPath = `${channelPath}/${event.name}`.replace(/\/+/g, '/');

            if (!spec.paths[eventPath]) {
                spec.paths[eventPath] = {};
            }

            const operation: any = {
                parameters: [],
                responses: {}
            };

            const operationMetadata = Reflect.getMetadata(METADATA_KEYS.API_OPERATION, socketPrototype, event.propertyKey);
            if (operationMetadata) {
                Object.assign(operation, operationMetadata);
            }

            const methodTags = Reflect.getMetadata(METADATA_KEYS.API_TAGS, socketPrototype, event.propertyKey);
            operation.tags = [...(methodTags || []), ...classTags];

            const apiResponses = Reflect.getMetadata(METADATA_KEYS.API_RESPONSES, socketPrototype)?.[event.propertyKey] || [];

            if (apiResponses.length > 0) {
                for (const response of apiResponses) {
                    const statusCode = String(response.status);
                    let responseContent = undefined;

                    if (response.type) {
                        const responseSchema = getSchemaFromType(response.type);
                        responseContent = response.isArray
                            ? {type: 'array', items: responseSchema}
                            : responseSchema;
                    }

                    operation.responses[statusCode] = {
                        description: response.description || '',
                        ...(responseContent ? {content: {'application/json': {schema: responseContent}}} : {})
                    };
                }
            } else {
                operation.responses['200'] = {
                    description: 'Successful response'
                };
            }

            const apiRequestBody = Reflect.getMetadata(METADATA_KEYS.API_REQUEST_BODY, socketPrototype, event.propertyKey);
            const dataSchema = apiRequestBody?.type
                ? getSchemaFromType(apiRequestBody.type)
                : {type: 'object'};

            operation.requestBody = {
                required: apiRequestBody?.required ?? true,
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                event: {type: 'string', enum: [event.name], example: event.name},
                                data: dataSchema
                            },
                            required: ['event', 'data']
                        }
                    }
                }
            };

            operation['x-websocket'] = {
                channel: channelPath,
                event: event.name
            };

            (spec.paths[eventPath] as any).post = operation;
        }
    }

    return spec;
}

/**
 * Attempt to derive a JSON Schema fragment from a TypeScript type.
 * This is a simplified implementation; for production use, consider using
 * a library like @sinclair/typebox or class-transformer to generate schemas.
 */
export function getSchemaFromType(type: any, visited: Set<any> = new Set()): any {
    if (typeof type !== 'function') {
        // Not a constructor; fallback to basic type detection
        return getPrimitiveTypeSchema(typeof type);
    }

    if (visited.has(type)) {
        return {type: 'object', description: 'Circular reference'};
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
            // For custom classes (DTOs, entities, etc.), check for @ApiProperty
            // We use Reflect.getMetadata to support inheritance of properties
            const properties = Reflect.getMetadata(METADATA_KEYS.API_PROPERTY, type);

            if (properties) {
                visited.add(type);
                const schema: any = {
                    type: 'object',
                    properties: {},
                    required: []
                };

                for (const [key, options] of Object.entries(properties) as [string, any][]) {
                    let propSchema: any;
                    const propType = options.type;

                    if (options.isArray) {
                        propSchema = {
                            type: 'array',
                            items: propType ? getSchemaFromType(propType, new Set(visited)) : {type: 'string'}
                        };
                    } else if (propType) {
                        propSchema = getSchemaFromType(propType, new Set(visited));
                    } else {
                        propSchema = {type: 'string'};
                    }

                    if (options.description) propSchema.description = options.description;
                    if (options.example) propSchema.example = options.example;
                    if (options.enum) propSchema.enum = options.enum;

                    schema.properties[key] = propSchema;
                    if (options.required) {
                        schema.required.push(key);
                    }
                }

                if (schema.required.length === 0) {
                    delete schema.required;
                }

                return schema;
            }

            return {type: 'object'};
    }
}

/**
 * Get schema for primitive types (string, number, boolean, bigint, symbol, undefined, object, function)
 */
export function getPrimitiveTypeSchema(primitive: string): any {
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
// export function generateHtml(title: string, endpoint: string): string {
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