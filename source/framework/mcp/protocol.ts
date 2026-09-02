import type {
    JsonRpcError,
    JsonRpcRequest,
    JsonRpcResponse,
} from "../../types";

export const McpVersion = '2024-11-05'
export const LatestProtocolVersion = '2024-11-05'

export enum JsonRpcErrorCode {
    PARSE_ERROR = -32700,
    INVALID_REQUEST = -32600,
    METHOD_NOT_FOUND = -32601,
    INVALID_PARAMS = -32602,
    INTERNAL_ERROR = -32603,
    SERVER_NOT_INITIALIZED = -32002,
}

export function rpcError(code: number, message: string, data?: any): JsonRpcError {
    return {code, message, ...(data !== undefined ? {data} : {})}
}

export function rpcSuccess(id: JsonRpcRequest['id'], result: any): JsonRpcResponse {
    return {jsonrpc: '2.0', id: id ?? null, result}
}

export function rpcFailure(id: JsonRpcRequest['id'], error: JsonRpcError): JsonRpcResponse {
    return {jsonrpc: '2.0', id: id ?? null, error}
}

export function isJsonRpcRequest(value: any): value is JsonRpcRequest {
    return typeof value === 'object'
        && value !== null
        && typeof value.method === 'string'
        && ('jsonrpc' in value ? (value as any).jsonrpc === '2.0' : true)
        && !('result' in value)
        && !('error' in value)
}

export function parseJsonRpc(body: any): JsonRpcRequest[] {
    if (body === null || body === undefined) return []
    if (Array.isArray(body)) {
        const requests: JsonRpcRequest[] = []
        for (const item of body) {
            if (isJsonRpcRequest(item)) requests.push(item)
        }
        return requests
    }
    return isJsonRpcRequest(body) ? [body] : []
}