/**
 * Decorator metadata keys.
 *
 * `Symbol.for` is used deliberately: artifact packages compiled separately must
 * expose metadata readable by the host application even when two copies of the
 * framework coexist in `node_modules`. Local `Symbol()` values would make each
 * copy unable to see the other's decorators (see spec 004, FR-048).
 */
export const METADATA_KEYS = {
    CONTROLLERS: Symbol.for('raiton:controller:meta'),
    SOCKETS: Symbol.for('raiton:socket:meta'),
    SOCKET_EVENTS: Symbol.for('raiton:socket:event:meta'),
    ROUTE_PARAMETERS: Symbol.for('raiton:route:meta'),
    GRAFTS: Symbol.for('raiton:graft:meta'),
    CONTAINER: Symbol.for('raiton:container:meta'),
    INJECT_PARAMETERS: Symbol.for('raiton:inject:parameters'),
    INJECT_PROPERTIES: Symbol.for('raiton:inject:properties'),
    // OpenAPI metadata keys
    API_RESPONSES: Symbol.for('raiton:api:responses'),
    API_REQUEST_BODY: Symbol.for('raiton:api:requestBody'),
    API_PARAMETERS: Symbol.for('raiton:api:parameters'),
    API_ENUMS: Symbol.for('raiton:api:enums'),
    API_TAGS: Symbol.for('raiton:api:tags'),
    API_OPERATION: Symbol.for('raiton:api:operation'),
    API_SECURITY: Symbol.for('raiton:api:security'),
    API_PROPERTY: Symbol.for('raiton:api:property'),
    // Route interaction metadata key
    ROUTE_INTERACTION: Symbol.for('raiton:route:interaction'),
    // Route cache metadata key
    CACHE: Symbol.for('raiton:route:cache'),
    // Health check metadata key
    HEALTH_CHECK: Symbol.for('raiton:health:check'),
    // MCP metadata keys
    MCP: Symbol.for('raiton:mcp:meta'),
    MCP_ELEMENTS: Symbol.for('raiton:mcp:elements'),
    MCP_ARGUMENTS: Symbol.for('raiton:mcp:arguments'),
    // Scheduler metadata keys
    SCHEDULER: Symbol.for('raiton:scheduler:meta'),
    // Schema-first contract metadata keys
    CONTRACT_INPUT: Symbol.for('raiton:contract:input'),
    CONTRACT_OUTPUT: Symbol.for('raiton:contract:output'),
    // Documentation / discoverability metadata
    PUBLIC_EXPORT: Symbol.for('raiton:docs:public-export'),
}
