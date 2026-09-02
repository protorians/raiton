export type McpArgumentType = 'string' | 'number' | 'boolean' | 'integer' | 'array' | 'object' | 'null';

export interface McpArgumentSchema {
    type?: McpArgumentType;
    description?: string;
    required?: boolean;
    enum?: any[];
    default?: any;
    items?: McpArgumentSchema;
    properties?: Record<string, McpArgumentSchema>;
}

export interface McpArgumentMetaInterface {
    name: string;
    description?: string;
    schema?: McpArgumentSchema;
    required?: boolean;
    metatype?: any;
}

export type McpElementType = 'tool' | 'prompt' | 'resource' | 'resource-template' | 'read';

export interface McpElementMetaInterface {
    type: McpElementType;
    name: string;
    description?: string;
    propertyKey: string;
    arguments: McpArgumentMetaInterface[];
    uri?: string;
    mimeType?: string;
    title?: string;
}

export interface McpServerMetaInterface {
    name?: string;
    version?: string;
    description?: string;
    path: string;
    instructions?: string;
    tools: McpElementMetaInterface[];
    prompts: McpElementMetaInterface[];
    resources: McpElementMetaInterface[];
    resourceTemplates: McpElementMetaInterface[];
}

export interface McpServerOptionsInterface {
    name?: string;
    version?: string;
    description?: string;
    path?: string;
    instructions?: string;
}

export type McpNodeMethod =
    | 'initialize'
    | 'ping'
    | 'tools/list'
    | 'tools/call'
    | 'prompts/list'
    | 'prompts/get'
    | 'resources/list'
    | 'resources/templates/list'
    | 'resources/read'
    | 'logging/setLevel';

export type McpTransportType = 'streamable-http' | 'stdio';

export interface McpServerRegistrationInterface {
    path: string;
    name: string;
    version: string;
    description?: string;
    construct: any;
    metadata: McpServerMetaInterface;
}

export interface McpRouteDescriptorInterface {
    path: string;
    propertyKey: string;
    serverName: string;
}

export interface JsonRpcRequest {
    jsonrpc?: string;
    method: string;
    params?: any;
    id?: number | string | null;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: any;
}

export interface JsonRpcResponse {
    jsonrpc: string;
    id: number | string | null;
    result?: any;
    error?: JsonRpcError;
}

export type McpArgumentDecorator =
    | string
    | McpArgumentMetaInterface;

export interface McpToolResultContent {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: any;
}

export interface McpTextContent {
    type: 'text';
    text: string;
}