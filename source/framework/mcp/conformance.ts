import type {McpInvocationContext, McpServerRegistrationInterface} from "../../types/index.ts";
import {LatestProtocolVersion} from "./protocol.ts";
import {mcpHandlePost} from "./streamable-http.ts";
import {McpStdioServer} from "./stdio.ts";
import {PassThrough} from "node:stream";
import {RaitonConfig} from "../../core/config/config.ts";

export interface McpConformanceTransport {
    name: "streamable-http" | "stdio";
    request(method: string, params?: any): Promise<any>;
    close?(): void | Promise<void>;
}

export interface McpConformanceCheck {
    name: string;
    passed: boolean;
    detail?: string;
}

export interface McpConformanceResult {
    transport: string;
    passed: boolean;
    checks: McpConformanceCheck[];
}

function sampleValue(schema: any): any {
    if (!schema) return undefined;
    if (schema.default !== undefined) return schema.default;
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    switch (schema.type) {
        case "string":
            return "conformance";
        case "number":
        case "integer":
            return 1;
        case "boolean":
            return true;
        case "array":
            return [];
        case "object":
            return {};
        default:
            return "conformance";
    }
}

function sampleArguments(schema: any): Record<string, any> {
    const output: Record<string, any> = {};
    const required: string[] = Array.isArray(schema?.required) ? schema.required : [];
    for (const key of required) {
        output[key] = sampleValue(schema?.properties?.[key]);
    }
    return output;
}

/**
 * The same conformance suite runs against the HTTP and stdio transports.
 */
export async function runMcpConformance(
    transport: McpConformanceTransport,
    options: {allowDestructive?: boolean} = {},
): Promise<McpConformanceResult> {
    const checks: McpConformanceCheck[] = [];
    const add = (name: string, passed: boolean, detail?: string) => checks.push({name, passed, detail});

    let initialized: any;
    try {
        initialized = await transport.request("initialize", {
            protocolVersion: LatestProtocolVersion,
            capabilities: {},
            clientInfo: {name: "raiton-conformance", version: "1.0.0"},
        });
        add("initialize", Boolean(initialized?.serverInfo?.name), initialized?.serverInfo?.name);
    } catch (error: any) {
        add("initialize", false, error?.message ?? String(error));
    }

    try {
        await transport.request("initialize", {
            protocolVersion: "0000-00-00",
            capabilities: {},
            clientInfo: {name: "raiton-conformance", version: "1.0.0"},
        });
        add("initialize unsupported version", false, "expected an error");
    } catch {
        add("initialize unsupported version", true);
    }

    try {
        const pong = await transport.request("ping");
        add("ping", pong !== undefined);
    } catch (error: any) {
        add("ping", false, error?.message ?? String(error));
    }

    let tools: any[] = [];
    try {
        const listing = await transport.request("tools/list");
        tools = Array.isArray(listing?.tools) ? listing.tools : [];
        const schemasValid = tools.every(tool => tool.inputSchema && typeof tool.inputSchema === "object");
        const destructiveVisible = tools.some(tool => tool.annotations?.destructiveHint === true);
        add("tools/list", schemasValid && (options.allowDestructive || !destructiveVisible), `${tools.length} tool(s)`);
    } catch (error: any) {
        add("tools/list", false, error?.message ?? String(error));
    }

    if (tools.length > 0) {
        const tool = tools[0];
        try {
            const result = await transport.request("tools/call", {
                name: tool.name,
                arguments: sampleArguments(tool.inputSchema),
            });
            const hasContent = Array.isArray(result?.content) || result?.structuredContent !== undefined;
            add("tools/call", hasContent, tool.name);
        } catch (error: any) {
            add("tools/call", false, error?.message ?? String(error));
        }
    } else {
        add("tools/call", true, "no tools exposed");
    }

    try {
        await transport.request("tools/call", {name: "__raiton_missing_tool__", arguments: {}});
        add("tools/call unknown", false, "expected an error");
    } catch {
        add("tools/call unknown", true);
    }

    return {
        transport: transport.name,
        passed: checks.every(check => check.passed),
        checks,
    };
}

/**
 * HTTP transport adapter used by `raiton mcp conformance` and tests.
 */
export function createHttpConformanceTransport(
    entry: McpServerRegistrationInterface,
    context?: McpInvocationContext,
): McpConformanceTransport {
    let id = 0;
    return {
        name: "streamable-http",
        async request(method, params) {
            const response = await mcpHandlePost(entry, {
                jsonrpc: "2.0",
                id: ++id,
                method,
                params,
            }, undefined, context);
            const payload: any = response.body;
            if (payload?.error) throw new Error(payload.error.message ?? "JSON-RPC error");
            return payload?.result;
        },
    };
}

/**
 * stdio transport adapter backed by an in-memory stream pair.
 */
export function createStdioConformanceTransport(
    entry: McpServerRegistrationInterface,
    context?: McpInvocationContext,
): McpConformanceTransport {
    const input = new PassThrough();
    const output = new PassThrough();
    const error = new PassThrough();
    const server = new McpStdioServer(entry, {input, output, error, context}).start();

    return {
        name: "stdio",
        request(method, params) {
            return server.request(method, params);
        },
        close() {
            server.stop();
            input.end();
        },
    };
}

export async function runAllConformance(
    entry: McpServerRegistrationInterface,
): Promise<McpConformanceResult[]> {
    const allowDestructive = entry.metadata.exposeDestructive === true
        || RaitonConfig.get("mcp")?.exposeDestructive === true;
    const http = await runMcpConformance(createHttpConformanceTransport(entry), {allowDestructive});
    const stdioTransport = createStdioConformanceTransport(entry);
    const stdio = await runMcpConformance(stdioTransport, {allowDestructive});
    await stdioTransport.close?.();
    return [http, stdio];
}
