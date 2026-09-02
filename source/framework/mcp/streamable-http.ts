import type {
    McpServerRegistrationInterface,
} from "../../types";
import {McpVersion} from "./protocol";
import {handleMcpRequest} from "./handler";

export const SESSION_HEADER = 'mcp-session-id'

function randomId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const SUPPORTED_VERSIONS = new Set(['2024-11-05', '2025-03-26', '2025-06-18', '2025-11-25'])

function isCompatibleVersion(version: string | undefined): boolean {
    if (version === undefined || version === null) return false
    return SUPPORTED_VERSIONS.has(version)
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
    const result = await handleMcpRequest(entry, body)

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