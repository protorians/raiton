import "reflect-metadata";
import {beforeEach, describe, expect, it} from "bun:test";
import {McpArg, McpServer, McpTool} from "../source/framework/decorators/index.ts";
import {t} from "../source/contracts/index.ts";
import {getMcpServer} from "../source/core/mcp/metadata.ts";
import {handleMcpRequest} from "../source/framework/mcp/handler.ts";
import {runAllConformance} from "../source/framework/mcp/conformance.ts";
import {McpAudit} from "../source/framework/mcp/audit.ts";
import {mcpRateLimiter} from "../source/framework/mcp/rate-limit.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import type {McpAuditEvent} from "../source/types/mcp.ts";

const EchoInput = t.object({message: t.string()});
const EchoOutput = t.object({message: t.string()});

@McpServer({
    name: "test-server",
    version: "1.0.0",
    path: "/mcp",
    rateLimitPerMinute: 50,
})
class TestServer {
    @McpTool({
        name: "echo",
        description: "Echo a message",
        inputSchema: EchoInput,
        outputSchema: EchoOutput,
        annotations: {readOnlyHint: true, destructiveHint: false},
    })
    echo(@McpArg({name: "message", description: "Message", metatype: String, required: true}) message: string) {
        return {message};
    }

    @McpTool({
        name: "authenticate",
        description: "Authentication test",
        annotations: {readOnlyHint: false},
    })
    authenticate(
        @McpArg({name: "token", description: "Token", metatype: String, required: true}) token: string,
        @McpArg({name: "password", description: "Password", metatype: String, required: true}) password: string,
    ) {
        return {ok: token === password};
    }

    @McpTool({
        name: "drop",
        description: "Destructive tool",
        annotations: {readOnlyHint: false, destructiveHint: true},
    })
    drop() {
        return {dropped: true};
    }

    @McpTool({
        name: "secret",
        description: "Scoped tool",
        scopes: ["secret:read"],
        annotations: {readOnlyHint: true},
    })
    secret() {
        return {secret: true};
    }
}

async function call(method: string, params?: any, context?: any) {
    const entry = getMcpServer("test-server")!;
    const result: any = await handleMcpRequest(entry, {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
    }, context);
    return Array.isArray(result.message) ? result.message[0] : result.message;
}

describe("MCP — schémas, sûreté et transports", () => {
    beforeEach(() => {
        mcpRateLimiter.reset();
        McpAudit.clear();
        RaitonConfig.reset();
    });

    it("masque les outils destructifs par défaut", async () => {
        const listing = await call("tools/list");
        const names = listing.result.tools.map((tool: any) => tool.name);

        expect(names).toContain("echo");
        expect(names).not.toContain("drop");
        expect(names.find((name: string) => name === "echo")).toBe("echo");

        const echo = listing.result.tools.find((tool: any) => tool.name === "echo");
        expect(echo.inputSchema.properties.message.type).toBe("string");
        expect(echo.outputSchema.properties.message.type).toBe("string");
        expect(echo.annotations.readOnlyHint).toBe(true);

        const hidden = await call("tools/call", {name: "drop", arguments: {}});
        expect(hidden.error.code).toBe(-32601);
    });

    it("expose un outil destructif uniquement sur autorisation explicite", async () => {
        RaitonConfig.current.set("mcp", {exposeDestructive: true} as any);
        const listing = await call("tools/list");
        expect(listing.result.tools.map((tool: any) => tool.name)).toContain("drop");
    });

    it("valide les arguments et retourne le contenu structuré", async () => {
        const invalid = await call("tools/call", {name: "echo", arguments: {message: 42}});
        expect(invalid.result.isError).toBe(true);
        expect(invalid.result.structuredContent.code).toBe("MCP_INVALID_ARGUMENTS");

        const valid = await call("tools/call", {name: "echo", arguments: {message: "hello"}});
        expect(valid.result.isError).toBe(false);
        expect(valid.result.structuredContent).toEqual({message: "hello"});
    });

    it("impose les scopes déclarés", async () => {
        const denied = await call("tools/call", {name: "secret", arguments: {}});
        expect(denied.result.isError).toBe(true);
        expect(denied.result.structuredContent.code).toBe("MCP_FORBIDDEN");

        const allowed = await call("tools/call", {name: "secret", arguments: {}}, {scopes: ["secret:read"]});
        expect(allowed.result.isError).toBe(false);
    });

    it("journalise un audit expurgé", async () => {
        const events: McpAuditEvent[] = [];
        McpAudit.on(event => events.push(event));

        await call("tools/call", {
            name: "authenticate",
            arguments: {token: "super-secret-token", password: "super-secret-token"},
        }, {actor: "tester"});

        expect(events).toHaveLength(1);
        expect(events[0].actor).toBe("tester");
        expect(events[0].tool).toBe("authenticate");
        expect(events[0].arguments.token).toBe("[redacted]");
        expect(events[0].arguments.password).toBe("[redacted]");
    });

    it("applique la limite de débit configurée", async () => {
        const entry = getMcpServer("test-server")!;
        const previous = entry.metadata.rateLimitPerMinute;
        entry.metadata.rateLimitPerMinute = 2;
        mcpRateLimiter.reset();
        try {
            const first = await call("tools/call", {name: "echo", arguments: {message: "a"}});
            const second = await call("tools/call", {name: "echo", arguments: {message: "b"}});
            const limited = await call("tools/call", {name: "echo", arguments: {message: "c"}});
            expect(first.result.isError).toBe(false);
            expect(second.result.isError).toBe(false);
            expect(limited.result.isError).toBe(true);
            expect(limited.result.structuredContent.code).toBe("MCP_RATE_LIMITED");
        } finally {
            entry.metadata.rateLimitPerMinute = previous;
            mcpRateLimiter.reset();
        }
    });

    it("passe la même suite de conformité en HTTP et stdio", async () => {
        const entry = getMcpServer("test-server")!;
        const results = await runAllConformance(entry);

        expect(results.map(result => result.transport).sort()).toEqual(["stdio", "streamable-http"]);
        for (const result of results) {
            expect(result.passed).toBe(true);
        }
    });
});
