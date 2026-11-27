import {createInterface, type Interface} from "node:readline";
import type {Readable, Writable} from "node:stream";
import type {
    JsonRpcRequest,
    JsonRpcResponse,
    McpInvocationContext,
    McpServerRegistrationInterface,
} from "../../types/index.ts";
import {handleMcpRequest} from "./handler.ts";
import {JsonRpcErrorCode, rpcError, rpcFailure} from "./protocol.ts";

export interface McpStdioOptions {
    input?: Readable;
    output?: Writable;
    error?: Writable;
    context?: McpInvocationContext;
}

/**
 * MCP stdio transport: newline-delimited JSON-RPC on stdin/stdout, exactly as
 * specified by the Model Context Protocol. Logs go to stderr so stdout remains
 * a pure protocol channel.
 */
export class McpStdioServer {
    private readonly input: Readable;
    private readonly output: Writable;
    private readonly error: Writable;
    private readonly context: McpInvocationContext;
    private readline?: Interface;
    private nextId = 1;
    private pending = new Map<string | number, {
        resolve: (value: any) => void;
        reject: (error: Error) => void;
    }>();
    private closed = false;

    constructor(
        public readonly entry: McpServerRegistrationInterface,
        options: McpStdioOptions = {},
    ) {
        this.input = options.input ?? process.stdin;
        this.output = options.output ?? process.stdout;
        this.error = options.error ?? process.stderr;
        this.context = {...options.context, transport: "stdio"};
    }

    start(): this {
        this.readline = createInterface({input: this.input, crlfDelay: Infinity});
        this.readline.on("line", line => {
            void this.handleLine(line);
        });
        this.readline.on("close", () => {
            this.closed = true;
            for (const pending of this.pending.values()) {
                pending.reject(new Error("MCP stdio transport closed"));
            }
            this.pending.clear();
        });
        return this;
    }

    private async handleLine(line: string): Promise<void> {
        const trimmed = line.trim();
        if (!trimmed) return;

        let body: any;
        try {
            body = JSON.parse(trimmed);
        } catch (error: any) {
            this.write({
                jsonrpc: "2.0",
                id: null,
                error: rpcError(JsonRpcErrorCode.PARSE_ERROR, "Parse error"),
            });
            return;
        }

        try {
            const result = await handleMcpRequest(this.entry, body, this.context);
            if (result.kind === "notification" || !result.message) return;
            const responses = Array.isArray(result.message) ? result.message : [result.message];
            for (const response of responses) {
                this.write(response);
                this.settle(response);
            }
        } catch (error: any) {
            this.error.write(`[raiton:mcp] ${error?.message ?? error}\n`);
            if (body && typeof body === "object" && !Array.isArray(body)) {
                this.write(rpcFailure((body as JsonRpcRequest).id ?? null, rpcError(
                    JsonRpcErrorCode.INTERNAL_ERROR,
                    error?.message ?? "Internal error",
                )));
            }
        }
    }

    private settle(response: JsonRpcResponse) {
        const id = response.id;
        if (id === null || id === undefined) return;
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        if (response.error) pending.reject(new Error(response.error.message));
        else pending.resolve(response.result);
    }

    private write(response: JsonRpcResponse) {
        this.output.write(`${JSON.stringify(response)}\n`);
    }

    /**
     * Client-style request used by `raiton mcp test`, conformance tests and
     * integrations. Close to the wire in both directions.
     */
    request(method: string, params?: any): Promise<any> {
        if (this.closed) return Promise.reject(new Error("MCP stdio transport closed"));
        const id = this.nextId++;
        const message: JsonRpcRequest = {jsonrpc: "2.0", id, method, params};
        return new Promise<any>((resolve, reject) => {
            this.pending.set(id, {resolve, reject});
            // Feed the request through the same line handler a real client would.
            void this.handleLine(JSON.stringify(message));
        });
    }

    notify(method: string, params?: any): void {
        this.output.write(`${JSON.stringify({jsonrpc: "2.0", method, params})}\n`);
    }

    stop(): void {
        this.readline?.close();
        this.closed = true;
    }
}

/**
 * Serve a registered MCP server over stdio until stdin closes.
 */
export async function serveMcpStdio(
    entry: McpServerRegistrationInterface,
    options: McpStdioOptions = {},
): Promise<void> {
    const server = new McpStdioServer(entry, options).start();
    await new Promise<void>(resolve => {
        const input = options.input ?? process.stdin;
        input.once("end", resolve);
        input.once("close", resolve);
    });
    server.stop();
}
