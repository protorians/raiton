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

/**
 * MCP tool safety annotations (spec 2024-11-05 / 2025-06-18).
 */
export interface McpToolAnnotations {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}

export interface McpElementMetaInterface {
    type: McpElementType;
    name: string;
    description?: string;
    propertyKey: string;
    arguments: McpArgumentMetaInterface[];
    uri?: string;
    mimeType?: string;
    title?: string;
    /** JSON schema or contract schema for tool input. */
    inputSchema?: any;
    /** JSON schema or contract schema for structured tool output. */
    outputSchema?: any;
    annotations?: McpToolAnnotations;
    /** Scopes required to call the tool. Empty means public. */
    scopes?: string[];
    /** Explicit destructive marker. `annotations.destructiveHint` wins. */
    destructive?: boolean;
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
    /** Expose destructive tools for this server. Defaults to false. */
    exposeDestructive?: boolean;
    /** Per-tool calls per minute. 0 disables the limiter. */
    rateLimitPerMinute?: number;
}

export interface McpServerOptionsInterface {
    name?: string;
    version?: string;
    description?: string;
    path?: string;
    instructions?: string;
    exposeDestructive?: boolean;
    rateLimitPerMinute?: number;
}

export interface McpToolOptions {
    name?: string;
    description?: string;
    inputSchema?: any;
    outputSchema?: any;
    annotations?: McpToolAnnotations;
    destructive?: boolean;
    scopes?: string[];
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

/**
 * Invocation context propagated by HTTP and stdio transports. Authentication
 * itself is out of scope for spec 002, but scopes and actor are enforced when
 * present so the future auth spec can plug in without an API change.
 */
export interface McpInvocationContext {
    actor?: string;
    scopes?: string[];
    headers?: Record<string, string>;
    transport?: McpTransportType;
    sessionId?: string;
}

export interface McpAuditEvent {
    callId: string;
    server: string;
    tool: string;
    actor?: string;
    transport?: McpTransportType;
    durationMs: number;
    success: boolean;
    error?: string;
    arguments?: any;
    result?: any;
}
