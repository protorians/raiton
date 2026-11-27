import type {McpInvocationContext, McpServerRegistrationInterface} from "../types/mcp.ts";
import {SESSION_HEADER, mcpHandleGet, mcpHandlePost} from "../framework/mcp/streamable-http.ts";
import {isBunUsed, isDenoUsed} from "../bin/constants.ts";
import {readDebugToken, safeCompare} from "./config.ts";

export interface DebugMcpHttpOptions {
    hostname?: string;
    port?: number;
    token?: string;
    scopes?: string[];
}

export interface DebugMcpHttpServer {
    url: string;
    close(): Promise<void>;
}

function unauthorized(): Response {
    return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: null,
        error: {code: -32001, message: "A valid debug token is required"},
    }), {status: 401, headers: {"content-type": "application/json"}});
}

function allowed(headers: any, token?: string): boolean {
    if (!token) return true;
    const supplied = readDebugToken(headers);
    return Boolean(supplied && safeCompare(String(supplied), token));
}

function jsonResponse(body: any, status = 200, sessionId?: string): Response {
    const headers: Record<string, string> = {"content-type": "application/json"};
    if (sessionId) headers[SESSION_HEADER] = sessionId;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {status, headers});
}

/**
 * Standalone debug MCP HTTP server used by `raiton mcp debug --http`.
 * The same handler as the application transport is used, so annotations,
 * scopes, audit and error shapes are identical.
 */
export async function serveDebugMcpHttp(
    entry: McpServerRegistrationInterface,
    options: DebugMcpHttpOptions = {},
): Promise<DebugMcpHttpServer> {
    const hostname = options.hostname || "127.0.0.1";
    const port = options.port ?? 5711;
    const context: McpInvocationContext = {
        transport: "streamable-http",
        actor: "raiton-debug-cli",
        scopes: options.scopes ?? ["debug:read", "debug:call", "debug:replay"],
    };

    const handler = async (request: Request): Promise<Response> => {
        const url = new URL(request.url);
        if (url.pathname !== "/mcp" && url.pathname !== "/__raiton/mcp") {
            return new Response(JSON.stringify({error: "Not Found"}), {status: 404, headers: {"content-type": "application/json"}});
        }
        if (!allowed(request.headers, options.token)) return unauthorized();

        if (request.method === "GET") {
            const session = request.headers.get(SESSION_HEADER) ?? undefined;
            const result = mcpHandleGet(entry, session);
            return jsonResponse(result.body, result.status, result.headers[SESSION_HEADER]);
        }

        if (request.method !== "POST") {
            return new Response("Method Not Allowed", {status: 405});
        }

        let body: any;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({jsonrpc: "2.0", id: null, error: {code: -32700, message: "Parse error"}}, 400);
        }

        const session = request.headers.get(SESSION_HEADER) ?? undefined;
        const result = await mcpHandlePost(entry, body, session, context);
        if (result.body === "") return jsonResponse("", result.status, result.headers[SESSION_HEADER]);
        return jsonResponse(result.body, result.status, result.headers[SESSION_HEADER]);
    };

    if (isBunUsed && typeof (globalThis as any).Bun?.serve === "function") {
        const server = (globalThis as any).Bun.serve({hostname, port, fetch: handler});
        return {
            url: `http://${hostname}:${server.port ?? port}/__raiton/mcp`,
            async close() {
                server.stop?.(true);
            },
        };
    }

    if (isDenoUsed && typeof (globalThis as any).Deno?.serve === "function") {
        const controller = new AbortController();
        const server = (globalThis as any).Deno.serve({
            hostname,
            port,
            signal: controller.signal,
            onListen: () => undefined,
        }, handler);
        return {
            url: `http://${hostname}:${port}/__raiton/mcp`,
            async close() {
                controller.abort();
                await server.finished;
            },
        };
    }

    const http = await import("node:http");
    const server = http.createServer(async (request, response) => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks).toString("utf-8");
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
            if (value === undefined) continue;
            headers.set(key, Array.isArray(value) ? value.join(",") : value);
        }
        const webRequest = new Request(`http://${hostname}:${port}${request.url}`, {
            method: request.method,
            headers,
            ...(body ? {body} : {}),
        });
        const webResponse = await handler(webRequest);
        response.statusCode = webResponse.status;
        webResponse.headers.forEach((value, key) => response.setHeader(key, value));
        response.end(await webResponse.text());
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, hostname, () => resolve());
    });

    return {
        url: `http://${hostname}:${port}/__raiton/mcp`,
        async close() {
            await new Promise<void>((resolve, reject) =>
                server.close(error => error ? reject(error) : resolve()));
        },
    };
}
