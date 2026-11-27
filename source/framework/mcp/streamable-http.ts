import type {
    McpInvocationContext,
    McpServerRegistrationInterface,
} from "../../types/index.ts";
import {McpVersion, SUPPORTED_PROTOCOL_VERSIONS} from "./protocol.ts";
import {handleMcpRequest} from "./handler.ts";

export const SESSION_HEADER = 'mcp-session-id'

function randomId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isCompatibleVersion(version: string | undefined): boolean {
    if (version === undefined || version === null) return false
    return SUPPORTED_PROTOCOL_VERSIONS.has(version)
}

function header(headers: any, name: string): string | undefined {
    if (!headers) return undefined;
    if (typeof headers.get === "function") return headers.get(name) ?? undefined;
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lower && value !== undefined) return String(value);
    }
    return undefined;
}

/**
 * Build the invocation context (actor, scopes, transport) from HTTP headers.
 * Authentication itself belongs to a future auth spec; scopes are enforced as
 * soon as they are present here.
 */
export function mcpContextFromHeaders(headers: any): McpInvocationContext {
    const scopes = (header(headers, "x-mcp-scopes") ?? "")
        .split(",")
        .map(scope => scope.trim())
        .filter(Boolean);
    return {
        actor: header(headers, "x-mcp-actor"),
        scopes,
        transport: "streamable-http",
    };
}

export function isMcpJsonRpc(body: any): boolean {
    if (Array.isArray(body)) {
        const first = body.find((r: any) => r && typeof r.method === 'string')
        return !!first
    }
    return body && typeof body === 'object' && typeof body.method === 'string'
}

export interface McpHttpResult {
    status: number
    body: any
    contentType: string
    headers: Record<string, string>
}

export async function mcpHandlePost(
    entry: McpServerRegistrationInterface,
    body: any,
    existingSessionId?: string,
    context?: McpInvocationContext,
): Promise<McpHttpResult> {
    if (!body || (!Array.isArray(body) && typeof body !== 'object')) {
        return {
            status: 400,
            body: {error: {code: -32700, message: 'Invalid JSON-RPC request'}},
            contentType: 'application/json',
            headers: {},
        }
    }

    const requests = Array.isArray(body) ? body : [body]
    const initializes = requests.filter((r: any) => r && r.method === 'initialize')
    if (initializes.length > 0) {
        const version = initializes[0].params?.protocolVersion
        if (!isCompatibleVersion(version)) {
            return {
                status: 406,
                body: {error: {code: -32600, message: `Unsupported protocol version. Expected: ${McpVersion}`}},
                contentType: 'application/json',
                headers: {},
            }
        }
    }

    const sessionId = existingSessionId || randomId()
    const result = await handleMcpRequest(entry, body, {
        transport: 'streamable-http',
        sessionId,
        ...context,
    })

    if (result.kind === 'notification') {
        return {
            status: 202,
            body: '',
            contentType: '',
            headers: {[SESSION_HEADER]: sessionId},
        }
    }

    return {
        status: 200,
        body: result.message as any,
        contentType: 'application/json',
        headers: {[SESSION_HEADER]: sessionId},
    }
}

export function mcpHandleGet(
    entry: McpServerRegistrationInterface,
    existingSessionId?: string,
): McpHttpResult {
    const sessionId = existingSessionId || randomId()
    return {
        status: 200,
        body: {jsonrpc: '2.0', id: null, result: {status: 'connected', sessionId}},
        contentType: 'application/json',
        headers: {[SESSION_HEADER]: sessionId},
    }
}