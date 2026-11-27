import type {PluginInterface} from "../types/plugin.ts";
import type {PluginScope} from "../core/plugins/scope.ts";
import type {ContextInterface} from "../types/core.ts";
import {HttpStatus} from "../framework/enums/http-status.enum.ts";
import {HttpMethod} from "../framework/enums/http-method.enum.ts";
import {errorPayload} from "../framework/errors/catalog.ts";
import {SESSION_HEADER, mcpHandleGet, mcpHandlePost} from "../framework/mcp/streamable-http.ts";
import {createDebugMcpEntry, runDebugDoctor} from "./mcp.ts";
import {explainEntry} from "./explain.ts";
import {invokeRoute, compareReplay} from "./invocation.ts";
import {findRequest, lastRequest, listRequests, listRequestsWithBodies, replayPath} from "./requests.ts";
import {verifyManifest} from "./verify.ts";
import {getDebugRuntime, loadDebugManifest, recordDebugLog, type DebugRuntimeState} from "./runtime.ts";
import {readDebugToken, safeCompare} from "./config.ts";
import type {McpInvocationContext, McpServerRegistrationInterface} from "../types/mcp.ts";
import {DEBUG_SCHEMA_VERSION} from "./types.ts";

function readHeader(headers: any, name: string): string | undefined {
    if (!headers) return undefined;
    if (typeof headers.get === "function") return headers.get(name) ?? undefined;
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lower && value !== undefined) return String(value);
    }
    return undefined;
}

function isLoopback(address?: string): boolean {
    if (!address) return true;
    return address === "127.0.0.1"
        || address === "::1"
        || address === "::ffff:127.0.0.1"
        || address.startsWith("127.");
}

interface GuardResult {
    allowed: boolean;
    status?: number;
    scopes: string[];
    body?: any;
}

const ALL_SCOPES = ["debug:read", "debug:call", "debug:replay", "debug:admin"];
const READ_CALL_SCOPES = ["debug:read", "debug:call"];

/**
 * Debug surfaces are local by default. A token is required as soon as the
 * surface is reachable from a non-loopback address or explicitly configured.
 */
function guard(ctx: any, runtime: DebugRuntimeState): GuardResult {
    const token = runtime.config.http.token;
    const supplied = readDebugToken(ctx.req?.headers);

    if (token) {
        if (!supplied || !safeCompare(String(supplied), String(token))) {
            return {
                allowed: false,
                status: HttpStatus.UNAUTHORIZED,
                scopes: [],
                body: errorPayload("UNAUTHORIZED", {
                    requestId: ctx.state?.requestId,
                    message: "A valid debug token is required",
                    hint: `Send the token in x-raiton-debug-token or Authorization: Bearer (source: ${runtime.config.http.tokenEnv}).`,
                }),
            };
        }
        return {allowed: true, scopes: ALL_SCOPES};
    }

    if (!runtime.development && !runtime.config.http.loopbackOnly) {
        return {
            allowed: false,
            status: HttpStatus.FORBIDDEN,
            scopes: [],
            body: errorPayload("FORBIDDEN", {
                requestId: ctx.state?.requestId,
                message: "Debug surfaces require a token outside development",
                hint: `Set ${runtime.config.http.tokenEnv} or keep loopbackOnly enabled.`,
            }),
        };
    }

    const address = ctx.req?.socket?.remoteAddress
        ?? ctx.req?.remoteAddress
        ?? ctx.req?.ip
        ?? ctx.req?.raw?.socket?.remoteAddress;
    if (runtime.config.http.loopbackOnly && !isLoopback(address)) {
        return {
            allowed: false,
            status: HttpStatus.FORBIDDEN,
            scopes: [],
            body: errorPayload("FORBIDDEN", {
                requestId: ctx.state?.requestId,
                message: "Debug surfaces are restricted to the loopback interface",
                hint: `Set ${runtime.config.http.tokenEnv} to allow remote debug access.`,
            }),
        };
    }

    return {allowed: true, scopes: READ_CALL_SCOPES};
}

function internal(handler: any) {
    handler._raitonInternal = true;
    return handler;
}

function bodyOf(ctx: ContextInterface): any {
    const body: any = ctx.req?.body;
    return body && typeof body === "object" && !(body instanceof Uint8Array) ? body : {};
}

function jsonError(ctx: any, error: any) {
    const status = typeof error?.statusCode === "number" ? error.statusCode : HttpStatus.INTERNAL_SERVER_ERROR;
    ctx.reply.status(status);
    return {
        error: true,
        schemaVersion: DEBUG_SCHEMA_VERSION,
        code: error?.code ?? "DEBUG_INTERNAL_ERROR",
        message: error?.message ?? String(error),
        ...(error?.hint ? {hint: error.hint} : {}),
        ...(error?.location ? {location: error.location} : {}),
        ...(error?.exitCode ? {exitCode: error.exitCode} : {}),
    };
}

/**
 * Mount the HTTP debug surface and the debug MCP transport.
 *
 * All handlers are marked internal so they never appear in the public manifest
 * inventory. The plugin is only registered when debug is enabled.
 */
export function debugPlugin(runtime: DebugRuntimeState): PluginInterface {
    return {
        name: "debug-plugin",
        setup: (scope: PluginScope) => {
            const base = runtime.config.http.basePath;
            const mcpEnabled = runtime.config.mcp.enabled;
            const httpEnabled = runtime.config.http.enabled;

            if (!httpEnabled && !mcpEnabled) return;

            const withGuard = (handler: (ctx: ContextInterface, guardResult: GuardResult) => Promise<any> | any) =>
                internal(async (ctx: ContextInterface) => {
                    const result = guard(ctx, runtime);
                    if (!result.allowed) {
                        ctx.reply.status(result.status ?? HttpStatus.FORBIDDEN);
                        return result.body;
                    }
                    ctx.state.debugScopes = result.scopes;
                    try {
                        return await handler(ctx, result);
                    } catch (error: any) {
                        recordDebugLog("error", `[debug] ${ctx.req?.method} ${ctx.req?.url}: ${error?.message ?? error}`);
                        return jsonError(ctx, error);
                    }
                });

            if (httpEnabled) {
                scope.get(`${base}`, withGuard(async () => ({
                    schemaVersion: DEBUG_SCHEMA_VERSION,
                    enabled: true,
                    endpoints: {
                        requests: `${base}/requests`,
                        explain: `${base}/explain/:requestId`,
                        replay: `${base}/replay/:requestId`,
                        call: `${base}/call`,
                        routes: `${base}/routes`,
                        manifest: `${base}/manifest`,
                        logs: `${base}/logs`,
                        doctor: `${base}/doctor`,
                        verify: `${base}/verify`,
                        mcp: mcpEnabled ? runtime.config.mcp.path : undefined,
                    },
                })));

                scope.get(`${base}/requests`, withGuard(async (ctx: ContextInterface) => {
                    const query = ctx.req.query ?? {};
                    const includeBodies = String((query as any).includeBodies ?? "") === "true";
                    const options = {
                        since: query.since as string,
                        status: query.status as string,
                        route: query.route as string,
                        limit: query.limit ? Number(query.limit) : undefined,
                        workdir: runtime.workdir,
                    };
                    return includeBodies
                        ? listRequestsWithBodies(options)
                        : listRequests(options);
                }));

                scope.get(`${base}/requests/:requestId`, withGuard(async (ctx: ContextInterface) => {
                    const lookup = findRequest(String((ctx as any).params?.requestId ?? ""), runtime.workdir);
                    if (!lookup) {
                        ctx.reply.status(HttpStatus.NOT_FOUND);
                        return errorPayload("NOT_FOUND", {
                            requestId: ctx.state?.requestId,
                            message: "Unknown request id",
                            hint: "Run `raiton requests` to list captured requests.",
                        });
                    }
                    return {schemaVersion: DEBUG_SCHEMA_VERSION, origin: lookup.origin, entry: lookup.entry};
                }));

                scope.get(`${base}/explain/:requestId`, withGuard(async (ctx: ContextInterface) => {
                    const id = String((ctx as any).params?.requestId ?? "");
                    const lookup = id === "last" ? lastRequest(runtime.workdir) : findRequest(id, runtime.workdir);
                    if (!lookup) {
                        ctx.reply.status(HttpStatus.NOT_FOUND);
                        return errorPayload("NOT_FOUND", {
                            requestId: ctx.state?.requestId,
                            message: "No request captured for this id",
                            hint: "Enable debug.journal.enabled and reproduce the request first.",
                        });
                    }
                    return explainEntry(lookup.entry, {
                        verbose: String((ctx.req.query as any)?.verbose ?? "") === "true",
                    });
                }));

                scope.route(HttpMethod.POST, `${base}/replay/:requestId`, withGuard(async (ctx: ContextInterface) => {
                    const id = String((ctx as any).params?.requestId ?? "");
                    const lookup = findRequest(id, runtime.workdir);
                    if (!lookup) {
                        ctx.reply.status(HttpStatus.NOT_FOUND);
                        return errorPayload("NOT_FOUND", {
                            requestId: ctx.state?.requestId,
                            message: "Unknown request id",
                        });
                    }
                    const entry = lookup.entry;
                    const method = entry.request.method.toUpperCase();
                    const idempotent = method === "GET" || method === "HEAD" || method === "OPTIONS";
                    const force = bodyOf(ctx).force === true || String((ctx.req.query as any)?.force ?? "") === "true";
                    if (!idempotent && !force && !runtime.config.replay.allowUnsafeMethods) {
                        ctx.reply.status(HttpStatus.BAD_REQUEST);
                        return errorPayload("BAD_REQUEST", {
                            requestId: ctx.state?.requestId,
                            message: "Replay of a non-idempotent method requires explicit confirmation",
                            hint: "Send { \"force\": true } or enable debug.replay.allowUnsafeMethods.",
                        });
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
                        workdir: runtime.workdir,
                    }, {
                        method,
                        path: replayPath(entry),
                        params: entry.request.params,
                        query: entry.request.query,
                        headers,
                        body: entry.request.body,
                        replayedFrom: id,
                    });
                    result.comparison = compareReplay(entry, result);
                    return result;
                }));

                scope.route(HttpMethod.POST, `${base}/call`, withGuard(async (ctx: ContextInterface) => {
                    const manifest = await loadDebugManifest();
                    const input = bodyOf(ctx);
                    return invokeRoute({
                        manifest,
                        application: runtime.application,
                        config: runtime.config,
                        workdir: runtime.workdir,
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
                }));

                scope.get(`${base}/routes`, withGuard(async () => {
                    const manifest = await loadDebugManifest();
                    return {schemaVersion: DEBUG_SCHEMA_VERSION, routes: manifest.routes};
                }));

                scope.get(`${base}/manifest`, withGuard(async () => loadDebugManifest()));

                scope.get(`${base}/logs`, withGuard(async (ctx: ContextInterface) => ({
                    schemaVersion: DEBUG_SCHEMA_VERSION,
                    lines: runtime.logs.tail(Number((ctx.req.query as any)?.limit ?? 50)),
                })));

                scope.get(`${base}/doctor`, withGuard(async () => runDebugDoctor()));

                scope.get(`${base}/verify`, withGuard(async (ctx: ContextInterface) => {
                    const manifest = await loadDebugManifest();
                    return verifyManifest({
                        manifest,
                        application: runtime.application,
                        config: runtime.config,
                        workdir: runtime.workdir,
                        route: (ctx.req.query as any)?.route,
                        allowUnsafe: String((ctx.req.query as any)?.allowUnsafe ?? "") === "true",
                    });
                }));

                scope.route(HttpMethod.POST, `${base}/verify`, withGuard(async (ctx: ContextInterface) => {
                    const manifest = await loadDebugManifest();
                    const input = bodyOf(ctx);
                    return verifyManifest({
                        manifest,
                        application: runtime.application,
                        config: runtime.config,
                        workdir: runtime.workdir,
                        route: input.route,
                        allowUnsafe: input.allowUnsafe === true,
                    });
                }));
            }

            if (mcpEnabled) {
                const entry: McpServerRegistrationInterface = createDebugMcpEntry(runtime.config.mcp.path);
                const path = runtime.config.mcp.path;
                const handlePost = internal(async (ctx: ContextInterface) => {
                    const result = guard(ctx, runtime);
                    if (!result.allowed) {
                        ctx.reply.status(result.status ?? HttpStatus.FORBIDDEN);
                        return result.body;
                    }
                    const context: McpInvocationContext = {
                        transport: "streamable-http",
                        actor: "raiton-debug",
                        scopes: result.scopes,
                    };
                    const session = readHeader(ctx.req?.headers, SESSION_HEADER);
                    const response = await mcpHandlePost(entry, ctx.req.body, session, context);
                    ctx.reply.status(response.status);
                    if (response.headers[SESSION_HEADER]) {
                        ctx.reply.header(SESSION_HEADER, response.headers[SESSION_HEADER]);
                    }
                    return response.body === "" ? "" : response.body;
                });
                const handleGet = internal(async (ctx: ContextInterface) => {
                    const result = guard(ctx, runtime);
                    if (!result.allowed) {
                        ctx.reply.status(result.status ?? HttpStatus.FORBIDDEN);
                        return result.body;
                    }
                    const session = readHeader(ctx.req?.headers, SESSION_HEADER);
                    const response = mcpHandleGet(entry, session);
                    ctx.reply.status(response.status);
                    if (response.headers[SESSION_HEADER]) {
                        ctx.reply.header(SESSION_HEADER, response.headers[SESSION_HEADER]);
                    }
                    return response.body;
                });
                scope.route(HttpMethod.POST, path, handlePost);
                scope.get(path, handleGet);
            }
        },
    };
}

export function debugSurfaceEnabled(): boolean {
    const runtime = getDebugRuntime();
    return Boolean(runtime && (runtime.config.http.enabled || runtime.config.mcp.enabled));
}
