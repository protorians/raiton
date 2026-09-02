import {registerMcpServer, unregisterMcpServer, getMcpServerMetadata} from "./metadata";
import {Injection} from "../injection";
import {McpServerRegistrationInterface} from "../../types";
import {McpRouteTracker} from "./tracker";
import {RaitonThread} from "../thread";
import {HttpMethod} from "../../framework/enums";
import {mcpHandleGet, mcpHandlePost, isMcpJsonRpc, SESSION_HEADER} from "../../framework/mcp/streamable-http";
import type {ContextInterface} from "../../types/core";

export function compileMcp(McpServerClass: any): McpServerRegistrationInterface | undefined {
    const metadata = getMcpServerMetadata(McpServerClass.prototype || McpServerClass)
    const name = metadata.name || McpServerClass.name
    if (!metadata.path) return undefined

    unregisterMcpServer(name)
    Injection.invalidateCascade(name)
    const entry = registerMcpServer(McpServerClass)

    const app = RaitonThread.current?.application
    const rootScope = (app as any)?.root

    McpRouteTracker.removeRoutes(name, rootScope?.router)

    if (app && rootScope?.router) {
        const path = metadata.path
        const postRoute = rootScope.route(
            HttpMethod.POST,
            path,
            async (context: ContextInterface) => {
                if (!isMcpJsonRpc(context.req.body)) {
                    return {error: {code: -32700, message: 'Invalid JSON-RPC request'}}
                }
                const existingSessionId = readSessionId(context)
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
            }
        )
        const getRoute = rootScope.route(
            HttpMethod.GET,
            path,
            async (context: ContextInterface) => {
                const existingSessionId = readSessionId(context)
                const result = mcpHandleGet(entry, existingSessionId)
                context.reply.status(result.status)
                if (result.headers[SESSION_HEADER]) {
                    context.reply.header(SESSION_HEADER, result.headers[SESSION_HEADER])
                }
                return result.body
            }
        )
        McpRouteTracker.setRoutes(name, [postRoute, getRoute])
    }

    return entry
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