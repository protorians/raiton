export const METADATA_KEYS = {
    CONTROLLERS: Symbol('controller:meta'),
    SOCKETS: Symbol('socket:meta'),
    SOCKET_EVENTS: Symbol('socket:event:meta'),
    ROUTE_PARAMETERS: Symbol('route:meta'),
    GRAFTS: Symbol('graft:meta'),
    CONTAINER: Symbol('container:meta'),
    INJECT_PARAMETERS: Symbol('inject:parameters'),
    INJECT_PROPERTIES: Symbol('inject:properties'),
    // OpenAPI metadata keys
    API_RESPONSES: Symbol('api:responses'),
    API_REQUEST_BODY: Symbol('api:requestBody'),
    API_PARAMETERS: Symbol('api:parameters'),
    API_ENUMS: Symbol('api:enums'),
    API_TAGS: Symbol('api:tags'),
    API_OPERATION: Symbol('api:operation'),
    API_SECURITY: Symbol('api:security'),
    API_PROPERTY: Symbol('api:property'),
    // Route interaction metadata key
    ROUTE_INTERACTION: Symbol('route:interaction'),
    // Health check metadata key
    HEALTH_CHECK: Symbol('health:check'),
    // MCP metadata keys
    MCP: Symbol('mcp:meta'),
    MCP_ELEMENTS: Symbol('mcp:elements'),
    MCP_ARGUMENTS: Symbol('mcp:arguments'),
}