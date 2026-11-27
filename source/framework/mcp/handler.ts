import type {
    JsonRpcRequest,
    JsonRpcResponse,
    McpElementMetaInterface,
    McpInvocationContext,
    McpServerRegistrationInterface,
    McpToolResultContent,
} from "../../types/index.ts";
import {
    JsonRpcErrorCode,
    LatestProtocolVersion,
    SUPPORTED_PROTOCOL_VERSIONS,
    rpcError,
    rpcFailure,
    rpcSuccess,
} from "./protocol.ts";
import {Injection} from "../../core/injection/index.ts";
import {RaitonConfig} from "../../core/config/config.ts";
import {contractToJsonSchema, validateContract} from "../../contracts/index.ts";
import {McpAudit} from "./audit.ts";
import {mcpRateLimiter} from "./rate-limit.ts";

export interface McpHandleResult {
    kind: 'response' | 'notification';
    message?: JsonRpcResponse | JsonRpcResponse[];
}

function isDestructive(tool: McpElementMetaInterface): boolean {
    return tool.annotations?.destructiveHint === true || tool.destructive === true;
}

/**
 * Default-deny: destructive tools are hidden unless the server explicitly
 * exposes them or project configuration opts in.
 */
export function isToolExposed(entry: McpServerRegistrationInterface, tool: McpElementMetaInterface): boolean {
    if (!isDestructive(tool)) return true;
    return entry.metadata.exposeDestructive === true
        || RaitonConfig.get("mcp")?.exposeDestructive === true;
}

function exposedTools(entry: McpServerRegistrationInterface): McpElementMetaInterface[] {
    return entry.metadata.tools.filter(tool => isToolExposed(entry, tool));
}

function toolInputSchema(tool: McpElementMetaInterface) {
    return tool.inputSchema ? contractToJsonSchema(tool.inputSchema) : argumentsToSchema(tool.arguments);
}

function toolOutputSchema(tool: McpElementMetaInterface) {
    return tool.outputSchema ? contractToJsonSchema(tool.outputSchema) : undefined;
}

export async function handleMcpRequest(
    registryEntry: McpServerRegistrationInterface,
    body: any,
    context?: McpInvocationContext,
): Promise<McpHandleResult> {
    const requests = Array.isArray(body) ? body : [body];
    const responses: JsonRpcResponse[] = [];
    let notificationOnly = true;

    for (const raw of requests) {
        if (!raw || typeof raw !== 'object' || typeof raw.method !== 'string') {
            responses.push(rpcFailure(null, rpcError(
                JsonRpcErrorCode.INVALID_REQUEST,
                'Invalid JSON-RPC request'
            )));
            notificationOnly = false;
            continue;
        }

        const request = raw as JsonRpcRequest
        const isNotification = request.id === undefined || request.id === null

        const handled = await dispatchMcpMethod(registryEntry, request, context)
        if (handled.kind === 'response' && handled.message) {
            const message = Array.isArray(handled.message) ? handled.message[0] : handled.message
            // Notifications never carry a response unless it's part of a batch with ids
            if (message && (!isNotification || (requests.length > 1 && request.id !== null && request.id !== undefined))) {
                responses.push(message)
            }
            if (!isNotification) notificationOnly = false
        }
    }

    if (responses.length > 0) {
        const message = responses.length === 1 ? responses[0] : responses
        return {kind: 'response', message}
    }

    if (notificationOnly) {
        return {kind: 'notification'}
    }

    return {kind: 'response', message: rpcFailure(requests[0]?.id ?? null, rpcError(
        JsonRpcErrorCode.INTERNAL_ERROR,
        'No response'
    ))}
}

async function dispatchMcpMethod(
    entry: McpServerRegistrationInterface,
    request: JsonRpcRequest,
    context?: McpInvocationContext,
): Promise<McpHandleResult> {
    const method = request.method
    const params = request.params || {}

    try {
        switch (method) {
            case 'initialize':
                if (params?.protocolVersion && !SUPPORTED_PROTOCOL_VERSIONS.has(params.protocolVersion)) {
                    return {kind: 'response', message: rpcFailure(request.id, rpcError(
                        JsonRpcErrorCode.INVALID_REQUEST,
                        `Unsupported protocol version: ${params.protocolVersion}`,
                    ))}
                }
                return {kind: 'response', message: rpcSuccess(request.id, handleInitialize(entry, params))}

            case 'notifications/initialized':
                return {kind: 'notification'}

            case 'ping':
                return {kind: 'response', message: rpcSuccess(request.id, {})}

            case 'tools/list':
                return {kind: 'response', message: rpcSuccess(request.id, listTools(entry))}

            case 'tools/call':
                return {kind: 'response', message: await callTool(entry, request.id, params, context)}

            case 'prompts/list':
                return {kind: 'response', message: rpcSuccess(request.id, listPrompts(entry))}

            case 'prompts/get':
                return {kind: 'response', message: await getPrompt(entry, request.id, params)}

            case 'resources/list':
                return {kind: 'response', message: rpcSuccess(request.id, getResourceList(entry))}

            case 'resources/templates/list':
                return {kind: 'response', message: rpcSuccess(request.id, getResourceTemplateList(entry))}

            case 'resources/read':
                return {kind: 'response', message: await readResource(entry, request.id, params)}

            case 'logging/setLevel':
                return {kind: 'notification'}

            default:
                return {kind: 'response', message: rpcFailure(request.id, rpcError(
                    JsonRpcErrorCode.METHOD_NOT_FOUND,
                    `Method not found: ${method}`
                ))}
        }
    } catch (e: any) {
        return {kind: 'response', message: rpcFailure(request.id, rpcError(
            JsonRpcErrorCode.INTERNAL_ERROR,
            e.message ?? 'Internal error'
        ))}
    }
}

function handleInitialize(entry: McpServerRegistrationInterface, _params: any) {
    return {
        protocolVersion: LatestProtocolVersion,
        capabilities: {
            tools: entry.metadata.tools.length > 0 ? {listChanged: false} : undefined,
            prompts: entry.metadata.prompts.length > 0 ? {listChanged: false} : undefined,
            resources: (entry.metadata.resources.length > 0 || entry.metadata.resourceTemplates.length > 0)
                ? {subscribe: false, listChanged: false}
                : undefined,
        },
        serverInfo: {
            name: entry.name,
            version: entry.version,
        },
        ...(entry.metadata.instructions ? {instructions: entry.metadata.instructions} : {}),
    }
}

function listTools(entry: McpServerRegistrationInterface) {
    return {
        tools: exposedTools(entry).map(element => ({
            name: element.name,
            title: element.title,
            description: element.description,
            inputSchema: toolInputSchema(element),
            ...(toolOutputSchema(element) ? {outputSchema: toolOutputSchema(element)} : {}),
            ...(element.annotations && Object.keys(element.annotations).length
                ? {annotations: element.annotations}
                : {}),
        })),
    }
}

function argumentsToSchema(args: {name: string; description?: string; required?: boolean; schema?: any}[]) {
    const properties: Record<string, any> = {}
    const required: string[] = []
    for (const arg of args) {
        const schema = arg.schema ? {...arg.schema} : {type: 'string'}
        if (arg.description) schema.description = arg.description
        properties[arg.name] = schema
        if (arg.required) required.push(arg.name)
    }
    return {
        type: 'object',
        properties,
        ...(required.length > 0 ? {required} : {}),
    }
}

function toolFailure(
    id: JsonRpcRequest['id'],
    code: string,
    message: string,
    details?: any,
): JsonRpcResponse {
    return rpcSuccess(id, {
        content: [{type: 'text', text: message}],
        structuredContent: {
            error: true,
            code,
            message,
            ...(details !== undefined ? {details} : {}),
        },
        isError: true,
    })
}

async function callTool(
    entry: McpServerRegistrationInterface,
    id: JsonRpcRequest['id'],
    params: any,
    context?: McpInvocationContext,
): Promise<JsonRpcResponse> {
    const name = params?.name
    const rawInput = params?.arguments || {}
    if (!name) {
        return rpcFailure(id, rpcError(JsonRpcErrorCode.INVALID_PARAMS, 'Tool name required'))
    }

    const tool = exposedTools(entry).find(t => t.name === name)
    if (!tool) {
        // Hidden destructive tools are indistinguishable from unknown tools.
        return rpcFailure(id, rpcError(JsonRpcErrorCode.METHOD_NOT_FOUND, `Tool not found: ${name}`))
    }

    if (tool.scopes?.length) {
        const granted = context?.scopes ?? [];
        if (!tool.scopes.some(scope => granted.includes(scope))) {
            return toolFailure(id, 'MCP_FORBIDDEN', `Missing scope for tool: ${name}`, {
                required: tool.scopes,
            })
        }
    }

    const limit = entry.metadata.rateLimitPerMinute
        ?? RaitonConfig.get("mcp")?.rateLimitPerMinute
        ?? 0;
    if (!mcpRateLimiter.consume(`${entry.name}:${tool.name}`, limit)) {
        return toolFailure(id, 'MCP_RATE_LIMITED', `Rate limit exceeded for tool: ${name}`)
    }

    const schema = toolInputSchema(tool) as any
    const validation = await validateContract(schema, rawInput)
    if (!validation.success) {
        return toolFailure(id, 'MCP_INVALID_ARGUMENTS', `Invalid arguments for tool: ${name}`, validation.issues)
    }

    const input = (validation.value ?? rawInput) as Record<string, any>
    const instance: any = Injection.resolve(entry.construct)
    if (!instance || typeof instance[tool.propertyKey] !== 'function') {
        return rpcFailure(id, rpcError(JsonRpcErrorCode.INTERNAL_ERROR, `Tool handler unavailable: ${name}`))
    }

    const callId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    const started = performance.now()
    let success = false
    let auditResult: any = undefined

    try {
        const args = collectArguments(instance, tool, input)
        const result = await instance[tool.propertyKey](...args)
        auditResult = result

        const outputSchema = toolOutputSchema(tool)
        if (outputSchema) {
            const output = await validateContract(outputSchema as any, result)
            if (!output.success) {
                return toolFailure(id, 'MCP_OUTPUT_VALIDATION_ERROR', `Invalid output for tool: ${name}`, output.issues)
            }
        }

        const content: McpToolResultContent[] = [{
            type: 'text',
            text: normalizeToolResult(result),
        }]

        success = true
        return rpcSuccess(id, {
            content,
            ...(result !== null && typeof result === 'object' && !Array.isArray(result)
                ? {structuredContent: result}
                : {}),
            isError: false,
        })
    } catch (e: any) {
        return rpcSuccess(id, {
            content: [{type: 'text', text: `Error: ${e.message ?? e}`}],
            isError: true,
        })
    } finally {
        McpAudit.emit({
            callId,
            server: entry.name,
            tool: name,
            actor: context?.actor,
            transport: context?.transport,
            durationMs: Math.round(performance.now() - started),
            success,
            arguments: input,
            result: auditResult,
        })
    }
}

function normalizeToolResult(result: any): string {
    if (result === null || result === undefined) return ''
    if (typeof result === 'string') return result
    try {
        return JSON.stringify(result)
    } catch {
        return String(result)
    }
}

function listPrompts(entry: McpServerRegistrationInterface) {
    return {
        prompts: entry.metadata.prompts.map(element => ({
            name: element.name,
            description: element.description,
            arguments: element.arguments
                .filter(a => a.required !== false)
                .map(a => ({
                    name: a.name,
                    description: a.description,
                    required: a.required ?? true,
                })),
        })),
    }
}

async function getPrompt(entry: McpServerRegistrationInterface, id: JsonRpcRequest['id'], params: any): Promise<JsonRpcResponse> {
    const name = params?.name
    if (!name) {
        return rpcFailure(id, rpcError(JsonRpcErrorCode.INVALID_PARAMS, 'Prompt name required'))
    }

    const prompt = entry.metadata.prompts.find(p => p.name === name)
    if (!prompt) {
        return rpcFailure(id, rpcError(JsonRpcErrorCode.METHOD_NOT_FOUND, `Prompt not found: ${name}`))
    }

    const instance: any = Injection.resolve(entry.construct)
    const args = collectArguments(instance, prompt, params?.arguments || {})
    const result = await instance[prompt.propertyKey](...args)

    const rendered = normalizeTemplate(prompt, result)
    return rpcSuccess(id, {
        description: prompt.description,
        messages: [
            {
                role: 'user',
                content: {type: 'text', text: rendered},
            },
        ],
    })
}

function normalizeTemplate(prompt: McpElementMetaInterface, result: any): string {
    if (typeof result === 'string') return result
    if (result && typeof result === 'object' && 'messages' in result) return JSON.stringify(result.messages)
    return normalizeToolResult(result)
}

function getResourceList(entry: McpServerRegistrationInterface) {
    const resources = entry.metadata.resources.map(element => ({
        uri: element.uri,
        name: element.name || element.propertyKey,
        description: element.description,
        mimeType: element.mimeType,
    }))
    return {resources}
}

function getResourceTemplateList(entry: McpServerRegistrationInterface) {
    const templates = entry.metadata.resourceTemplates.map(element => ({
        uriTemplate: element.uri,
        name: element.name || element.propertyKey,
        description: element.description,
        mimeType: element.mimeType,
    }))
    return {resourceTemplates: templates}
}

async function readResource(entry: McpServerRegistrationInterface, id: JsonRpcRequest['id'], params: any): Promise<JsonRpcResponse> {
    const uri = params?.uri
    if (!uri) {
        return rpcFailure(id, rpcError(JsonRpcErrorCode.INVALID_PARAMS, 'Resource URI required'))
    }

    const resource = entry.metadata.resources.find(r => r.uri === uri)
        || entry.metadata.resourceTemplates.find(r => !!r.uri && matchesTemplate(r.uri, uri))
    if (!resource || !resource.uri) {
        return rpcFailure(id, rpcError(JsonRpcErrorCode.METHOD_NOT_FOUND, `Resource not found: ${uri}`))
    }

    const instance: any = Injection.resolve(entry.construct)
    if (!instance || typeof instance[resource.propertyKey] !== 'function') {
        return rpcFailure(id, rpcError(JsonRpcErrorCode.INTERNAL_ERROR, `Resource handler unavailable: ${uri}`))
    }

    try {
        const templateArgs = extractTemplateArgs(resource.uri, uri)
        const args = collectArguments(instance, resource, templateArgs)
        const result = await instance[resource.propertyKey](...args)

        const contents = [{
            uri,
            mimeType: resource.mimeType || 'text/plain',
            text: normalizeToolResult(result),
        }]

        return rpcSuccess(id, {contents})
    } catch (e: any) {
        return rpcFailure(id, rpcError(JsonRpcErrorCode.INTERNAL_ERROR, e.message ?? 'Resource read error'))
    }
}

function matchesTemplate(template: string, uri: string): boolean {
    return templateToRegExp(template).test(uri)
}

function extractTemplateArgs(template: string, uri: string): Record<string, any> {
    const regex = templateToRegExp(template)
    const match = uri.match(regex)
    if (!match) return {}
    const names = (template.match(/\{([^}]+)\}/g) || []).map(n => n.slice(1, -1))
    const args: Record<string, any> = {}
    names.forEach((name, index) => {
        args[name] = match[index + 1]
    })
    return args
}

function templateToRegExp(template: string): RegExp {
    const escapedTemplate = template.replace(/\{[^}]+\}/g, '([^/]+)')
    return new RegExp(`^${escapedTemplate}$`)
}

// Collect arguments from the decorated method, mapping MCP argument metadata to positional values.
// When no argument metadata is declared, the full input object (or a single argument value) is passed through.
function collectArguments(instance: any, element: McpElementMetaInterface, input: Record<string, any>): any[] {
    if (element.arguments.length === 0) {
        return [input]
    }
    const args: any[] = []
    for (const arg of element.arguments) {
        const value = input[arg.name] ?? arg.schema?.default ?? undefined
        args.push(coerceArgument(value, arg))
    }
    return args
}

function coerceArgument(value: any, arg: {schema?: any; metatype?: any}): any {
    if (value === undefined) return undefined
    const type = arg.schema?.type || (arg.metatype?.name?.toLowerCase())
    switch (type) {
        case 'number':
        case 'integer':
            return typeof value === 'number' ? value : Number(value)
        case 'boolean':
            return typeof value === 'boolean' ? value : value === 'true' || value === true || value === '1'
        case 'string':
            return typeof value === 'string' ? value : String(value)
        default:
            return value
    }
}
