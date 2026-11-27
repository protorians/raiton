import "reflect-metadata";
import {LifetimeEnum} from "@protorians/core";
import type {
    McpElementMetaInterface,
    McpServerMetaInterface,
    McpServerRegistrationInterface,
} from "../types/mcp.ts";
import {Injectable} from "../framework/decorators/injection.decorator.ts";
import {getMcpServer, getMcpServerRegistry, registerMcpServer} from "../core/mcp/metadata.ts";
import {RaitonConfig} from "../core/config/config.ts";
import {validateManifest} from "../manifest/schema.ts";
import type {ProjectManifest} from "../manifest/schema.ts";
import {getDebugJournal, getDebugRuntime, loadDebugManifest} from "./runtime.ts";
import {explainEntry} from "./explain.ts";
import {invokeRoute, compareReplay} from "./invocation.ts";
import {listRequests, replayPath} from "./requests.ts";
import type {DebugDoctorReport, DebugExplanation, DebugJournalEntry} from "./types.ts";
import {DEBUG_SCHEMA_VERSION} from "./types.ts";

export const DEBUG_MCP_SERVER_NAME = "raiton-debug";

const ANY_OBJECT = {type: "object", additionalProperties: true};

function tool(
    name: string,
    description: string,
    propertyKey: string,
    inputSchema: any,
    annotations: {readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean},
    scopes: string[],
): McpElementMetaInterface {
    return {
        type: "tool",
        name,
        description,
        propertyKey,
        arguments: [],
        inputSchema,
        outputSchema: ANY_OBJECT,
        annotations,
        scopes,
    };
}

class RaitonDebugTools {
    async routesList(_input: any = {}) {
        const manifest = await loadDebugManifest();
        return {
            schemaVersion: DEBUG_SCHEMA_VERSION,
            routes: manifest.routes,
        };
    }

    async routesGet(input: any = {}) {
        const manifest = await loadDebugManifest();
        const method = String(input.method ?? "GET").toUpperCase();
        const path = String(input.path ?? "/");
        const route = manifest.routes.find(item =>
            item.method.toUpperCase() === method
            && (item.path === path || item.path.replace(/\/+$/, "") === path.replace(/\/+$/, "")));
        if (!route) {
            throw new Error(`Route not found: ${method} ${path}`);
        }
        return {schemaVersion: DEBUG_SCHEMA_VERSION, route};
    }

    async routesCall(input: any = {}) {
        const manifest = await loadDebugManifest();
        const runtime = getDebugRuntime();
        if (!input.method || !input.path) throw new Error("`method` and `path` are required");
        return invokeRoute({
            manifest,
            application: runtime?.application,
            config: runtime?.config,
            baseUrl: input.baseUrl,
            workdir: runtime?.workdir,
        }, {
            method: input.method,
            path: input.path,
            params: input.params,
            query: input.query,
            headers: input.headers,
            body: input.body,
            example: input.example,
            dryRun: input.dryRun === true,
            validate: input.validate !== false,
            timeoutMs: input.timeoutMs,
            baseUrl: input.baseUrl,
        });
    }

    async requestsRecent(input: any = {}) {
        return listRequests({
            since: input.since,
            status: input.status,
            route: input.route,
            limit: input.limit,
        });
    }

    async requestsGet(input: any = {}) {
        const journal = getDebugJournal();
        if (!journal) throw new Error("The request journal is disabled");
        const entry = journal.get(String(input.requestId ?? ""));
        if (!entry) throw new Error(`Unknown requestId: ${input.requestId}`);
        return entry;
    }

    async requestsExplain(input: any = {}): Promise<DebugExplanation> {
        const journal = getDebugJournal();
        if (!journal) throw new Error("The request journal is disabled");
        const entry = input.requestId
            ? journal.get(String(input.requestId))
            : journal.last();
        if (!entry) throw new Error("No request has been captured");
        return explainEntry(entry, {verbose: input.verbose === true});
    }

    async requestsReplay(input: any = {}) {
        const runtime = getDebugRuntime();
        const journal = getDebugJournal();
        if (!runtime || !journal) throw new Error("The request journal is disabled");
        const entry = journal.get(String(input.requestId ?? ""));
        if (!entry) throw new Error(`Unknown requestId: ${input.requestId}`);

        const method = entry.request.method.toUpperCase();
        const idempotent = method === "GET" || method === "HEAD" || method === "OPTIONS";
        if (!idempotent && input.force !== true && runtime.config.replay.allowUnsafeMethods !== true) {
            throw new Error(
                `Replaying a ${method} request requires an explicit force flag: ` +
                "replay is restricted to idempotent methods by default.",
            );
        }

        const manifest = await loadDebugManifest();
        const headers = {...(entry.request.headers ?? {})};
        for (const [key, value] of Object.entries(headers)) {
            if (value === "***") delete headers[key];
        }

        const result = await invokeRoute({
            manifest,
            application: runtime.application,
            config: runtime.config,
            baseUrl: input.baseUrl,
            workdir: runtime.workdir,
        }, {
            method,
            path: replayPath(entry),
            params: entry.request.params,
            query: entry.request.query,
            headers,
            body: entry.request.body,
            timeoutMs: input.timeoutMs,
            replayedFrom: entry.requestId,
            baseUrl: input.baseUrl,
        });
        result.comparison = compareReplay(entry, result);
        return result;
    }

    async doctorRun(_input: any = {}): Promise<DebugDoctorReport> {
        return runDebugDoctor();
    }

    async manifestGet(_input: any = {}) {
        return loadDebugManifest();
    }

    async logsTail(input: any = {}) {
        const runtime = getDebugRuntime();
        const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(200, Number(input.limit))) : 50;
        return {
            schemaVersion: DEBUG_SCHEMA_VERSION,
            lines: runtime?.logs.tail(limit) ?? [],
        };
    }
}

const DEBUG_TOOLS: Array<{
    name: string;
    description: string;
    propertyKey: keyof RaitonDebugTools;
    inputSchema: any;
    annotations: any;
    scopes: string[];
}> = [
    {
        name: "routes.list",
        description: "List the routes mounted by the application, with their input/output schemas.",
        propertyKey: "routesList",
        inputSchema: {type: "object", properties: {}, additionalProperties: false},
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        scopes: ["debug:read"],
    },
    {
        name: "routes.get",
        description: "Return the schema, examples and source location of one route.",
        propertyKey: "routesGet",
        inputSchema: {
            type: "object",
            properties: {method: {type: "string"}, path: {type: "string"}},
            required: ["method", "path"],
        },
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        scopes: ["debug:read"],
    },
    {
        name: "routes.call",
        description: "Invoke a route with local validation, output contract checking and a structured result.",
        propertyKey: "routesCall",
        inputSchema: {
            type: "object",
            properties: {
                method: {type: "string"},
                path: {type: "string"},
                params: {type: "object", additionalProperties: true},
                query: {type: "object", additionalProperties: true},
                headers: {type: "object", additionalProperties: {type: "string"}},
                body: {},
                example: {type: "string"},
                dryRun: {type: "boolean"},
                validate: {type: "boolean"},
                timeoutMs: {type: "number"},
                baseUrl: {type: "string"},
            },
            required: ["method", "path"],
        },
        annotations: {readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true},
        scopes: ["debug:call"],
    },
    {
        name: "requests.recent",
        description: "List the most recent journal entries without bodies.",
        propertyKey: "requestsRecent",
        inputSchema: {
            type: "object",
            properties: {
                since: {type: "string"},
                status: {type: "string"},
                route: {type: "string"},
                limit: {type: "number"},
            },
        },
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        scopes: ["debug:read"],
    },
    {
        name: "requests.get",
        description: "Return one journal entry by request id.",
        propertyKey: "requestsGet",
        inputSchema: {
            type: "object",
            properties: {requestId: {type: "string"}},
            required: ["requestId"],
        },
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        scopes: ["debug:read"],
    },
    {
        name: "requests.explain",
        description: "Explain a request: timeline, root cause, source location and next actions.",
        propertyKey: "requestsExplain",
        inputSchema: {
            type: "object",
            properties: {requestId: {type: "string"}, verbose: {type: "boolean"}},
        },
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        scopes: ["debug:read"],
    },
    {
        name: "requests.replay",
        description: "Replay a captured request; non-idempotent methods require an explicit force flag.",
        propertyKey: "requestsReplay",
        inputSchema: {
            type: "object",
            properties: {
                requestId: {type: "string"},
                force: {type: "boolean"},
                timeoutMs: {type: "number"},
                baseUrl: {type: "string"},
            },
            required: ["requestId"],
        },
        annotations: {readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true},
        scopes: ["debug:replay"],
    },
    {
        name: "doctor.run",
        description: "Diagnose configuration, manifest, journal and MCP surfaces.",
        propertyKey: "doctorRun",
        inputSchema: {type: "object", properties: {}, additionalProperties: false},
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        scopes: ["debug:read"],
    },
    {
        name: "manifest.get",
        description: "Return the versioned project manifest.",
        propertyKey: "manifestGet",
        inputSchema: {type: "object", properties: {}, additionalProperties: false},
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        scopes: ["debug:read"],
    },
    {
        name: "logs.tail",
        description: "Return the latest redacted framework log lines.",
        propertyKey: "logsTail",
        inputSchema: {
            type: "object",
            properties: {limit: {type: "number"}},
        },
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false},
        scopes: ["debug:read"],
    },
];

/**
 * Build (or reuse) the debug MCP server registration. Tools reuse the shared
 * MCP handler, so audit, scopes, rate limiting, annotations and both transports
 * behave exactly like application MCP servers.
 */
export function createDebugMcpEntry(path = "/__raiton/mcp"): McpServerRegistrationInterface {
    const existing = getMcpServer(DEBUG_MCP_SERVER_NAME);
    if (existing) {
        existing.path = path;
        existing.metadata.path = path;
        return existing;
    }

    Injectable(LifetimeEnum.TRANSIENT, "RaitonDebugMcpServer")(RaitonDebugTools as any);
    const entry = registerMcpServer(RaitonDebugTools as any);
    entry.name = DEBUG_MCP_SERVER_NAME;
    entry.path = path;
    entry.version = "1.0.0";
    entry.description = "AI-assisted runtime debug tools for Raiton";

    const metadata: McpServerMetaInterface = entry.metadata;
    metadata.name = DEBUG_MCP_SERVER_NAME;
    metadata.path = path;
    metadata.version = "1.0.0";
    metadata.description = entry.description;
    metadata.tools = DEBUG_TOOLS.map(item => tool(
        item.name,
        item.description,
        String(item.propertyKey),
        item.inputSchema,
        item.annotations,
        item.scopes,
    ));
    metadata.prompts = [];
    metadata.resources = [];
    metadata.resourceTemplates = [];
    metadata.exposeDestructive = false;
    metadata.rateLimitPerMinute = 120;

    // `registerMcpServer` registered under the class name; expose the stable
    // debug name instead of duplicating the server in the registry.
    getMcpServerRegistry().delete(entry.construct?.name ?? "RaitonDebugTools");
    getMcpServerRegistry().set(DEBUG_MCP_SERVER_NAME, entry);
    return entry;
}

export function debugMcpToolNames(): string[] {
    return DEBUG_TOOLS.map(item => item.name);
}

/** Shared diagnostic used by the `doctor.run` MCP tool and the HTTP surface. */
export async function runDebugDoctor(): Promise<DebugDoctorReport> {
    const runtime = getDebugRuntime();
    const manifest: ProjectManifest = await loadDebugManifest();
    const validation = validateManifest(manifest);
    const checks: DebugDoctorReport["checks"] = [
        {
            name: "configuration",
            passed: RaitonConfig.errors.length === 0,
            detail: RaitonConfig.errors.length
                ? RaitonConfig.errors.map(error => `${error.field}: ${error.message}`).join("; ")
                : "configuration is valid",
            hint: "Run `raiton doctor --json` for the full configuration report.",
        },
        {
            name: "manifest",
            passed: validation.valid,
            detail: validation.valid
                ? `schema ${manifest.schemaVersion}, ${manifest.routes.length} route(s)`
                : validation.errors.map(error => `${error.path}: ${error.message}`).join("; "),
            hint: "Run `raiton inspect --check`.",
        },
        {
            name: "journal",
            passed: Boolean(runtime?.journal),
            detail: runtime?.journal
                ? `${runtime.journal.size}/${runtime.journal.capacity} entries, ${runtime.journal.totalBytes} bytes`
                : "disabled",
            hint: "Enable `debug.journal.enabled` or set RAITON_DEBUG_JOURNAL=1.",
        },
        {
            name: "mcp",
            passed: Boolean(runtime?.config.mcp.enabled),
            detail: runtime?.config.mcp.path ?? "disabled",
        },
    ];
    return {
        schemaVersion: DEBUG_SCHEMA_VERSION,
        passed: checks.every(check => check.passed),
        checks,
    };
}

export type {DebugJournalEntry};
