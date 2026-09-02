import type {PluginInterface} from "../../types";
import type {ContextInterface} from "../../types/core";
import {PluginScope} from "../../core";
import {findMcpServerForPath} from "../../core/mcp/metadata";
import {isMcpJsonRpc, mcpHandleGet, mcpHandlePost, SESSION_HEADER} from "../mcp/streamable-http";

export interface McpPluginOptions {
    /**
     * Global prefix for all MCP endpoints.
     * A POST route will be registered at this path.
     * @default '/mcp'
     */
    path?: string;

    /**
     * Enable the GET endpoint (returns a JSON session handshake).
     * @default false
     */
    enableGet?: boolean;
}

export function mcpPlugin(options: McpPluginOptions = {}): PluginInterface {
    const {
        path = '/mcp',
        enableGet = false,
    } = options;

    return {
        name: 'mcp-plugin',
        setup: (scope: PluginScope) => {

            scope.route('POST', path, async (context: ContextInterface) => {
                const entry = findMcpServerForPath(path, undefined)
                if (!entry) {
                    return {error: {code: -32002, message: 'MCP server not registered at this path'}}
                }

                const existingSessionId = readSessionId(context)

                if (!isMcpJsonRpc(context.req.body)) {
                    return {error: {code: -32700, message: 'Invalid JSON-RPC request'}}
                }

                const result = await mcpHandlePost(entry, context.req.body, existingSessionId)
                context.reply.status(result.status)
                if (result.headers[SESSION_HEADER]) {
                    context.reply.header(SESSION_HEADER, result.headers[SESSION_HEADER])
                }
                if (result.body === '') {
                    context.reply.send('')
                    return
                }
                return result.body
            })

            if (enableGet) {
                scope.route('GET', path, async (context: ContextInterface) => {
                    const entry = findMcpServerForPath(path, undefined)
                    if (!entry) {
                        return {error: {code: -32002, message: 'MCP server not registered at this path'}}
                    }

                    const existingSessionId = readSessionId(context)
                    const result = mcpHandleGet(entry, existingSessionId)
                    context.reply.status(result.status)
                    if (result.headers[SESSION_HEADER]) {
                        context.reply.header(SESSION_HEADER, result.headers[SESSION_HEADER])
                    }
                    return result.body
                })
            }
        }
    }
}

function readSessionId(context: any): string | undefined {
    const req = context.req
    if (req?.headers?.get) {
        const value = req.headers.get(SESSION_HEADER)
        if (value) return value
    }
    if (req?.headers && typeof req.headers === 'object') {
        const value = (req.headers as any)[SESSION_HEADER]
        if (value) return value
    }
    return undefined
}