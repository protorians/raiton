import type {ApplicationInterface} from "../types/application.ts";
import type {ProjectManifest, ProjectRouteManifest} from "../manifest/schema.ts";
import {resolveDebugConfig} from "./config.ts";
import {configureDebug, getDebugRuntime, type DebugRuntimeState} from "./runtime.ts";
import {appendSessionEntry} from "./session.ts";
import type {
    DebugInvocationRequest,
    DebugInvocationResult,
    DebugJournalEntry,
} from "./types.ts";
import {DEBUG_SCHEMA_VERSION} from "./types.ts";

/**
 * Enable the journal on an application booted without a socket, so `raiton
 * call` and `raiton verify` can capture the in-process exchange and `explain`
 * can read it back later.
 */
export function enableCliDebug(
    application: ApplicationInterface,
    workdir: string,
): DebugRuntimeState {
    const resolved = resolveDebugConfig({development: true, workdir});
    const runtime = configureDebug({
        config: {
            ...resolved,
            enabled: true,
            // The CLI does not open the HTTP/MCP surfaces; it only captures.
            http: {...resolved.http, enabled: false},
            mcp: {...resolved.mcp, enabled: false},
        },
        development: true,
        workdir,
        application,
        buildId: getDebugRuntime()?.buildId,
    });
    (application as any).adoptDebugRuntime?.(runtime);
    return runtime;
}

export function baseUrlOf(application?: ApplicationInterface): string {
    const app: any = application;
    const config = app?.config ?? {};
    const protocol = app?.https?.enabled ? "https" : (config.protocole || "http");
    const host = config.hostname && config.hostname !== "0.0.0.0" ? config.hostname : "localhost";
    const port = config.port ? `:${config.port}` : "";
    const pathname = config.pathname && config.pathname !== "/" ? config.pathname.replace(/\/+$/, "") : "";
    const prefix = config.prefix ? `/${String(config.prefix).replace(/^\/+|\/+$/g, "")}` : "";
    return `${protocol}://${host}${port}${pathname}${prefix}`;
}

export interface RemoteDebugOptions {
    baseUrl: string;
    token?: string;
    timeoutMs?: number;
}

export interface RemoteDebugResponse {
    status: number;
    body: any;
}

/** Call the HTTP debug surface of a running application. */
export async function remoteDebug(
    options: RemoteDebugOptions,
    path: string,
    init: {method?: string; body?: any} = {},
): Promise<RemoteDebugResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 1_500);
    (timeout as any)?.unref?.();
    try {
        const headers: Record<string, string> = {accept: "application/json"};
        if (options.token) {
            headers["x-raiton-debug-token"] = options.token;
            headers.authorization = `Bearer ${options.token}`;
        }
        if (init.body !== undefined) headers["content-type"] = "application/json";
        const response = await fetch(`${options.baseUrl.replace(/\/+$/, "")}${path}`, {
            method: init.method ?? "GET",
            headers,
            ...(init.body !== undefined ? {body: JSON.stringify(init.body)} : {}),
            signal: controller.signal,
        });
        const text = await response.text();
        let body: any = undefined;
        if (text) {
            try {
                body = JSON.parse(text);
            } catch {
                body = text;
            }
        }
        return {status: response.status, body};
    } finally {
        clearTimeout(timeout);
    }
}

/** Probe whether a running application exposes the debug surface. */
export async function probeDebug(options: RemoteDebugOptions): Promise<RemoteDebugResponse | undefined> {
    try {
        const response = await remoteDebug(options, "/__raiton");
        if (response.status === 200 && response.body && typeof response.body === "object") return response;
        return response;
    } catch {
        return undefined;
    }
}

function sourceOf(route?: ProjectRouteManifest): DebugJournalEntry["source"] {
    if (!route?.file) return undefined;
    return {
        file: route.file,
        line: route.line,
        controller: route.controller,
        handler: route.handler,
        ...(route.method ? {decorator: `@${route.method.charAt(0)}${route.method.slice(1).toLowerCase()}("${route.path}")`} : {}),
    };
}

function codeOf(result: DebugInvocationResult): string {
    const body: any = result.response.body;
    if (body && typeof body === "object" && typeof body.code === "string") return body.code;
    if (result.contract.input === "invalid") return "VALIDATION_ERROR";
    if (result.contract.output === "invalid") return "OUTPUT_VALIDATION_ERROR";
    if (result.response.status === 0) return "INVOCATION_NOT_SENT";
    if (result.response.status >= 500) return "INTERNAL_SERVER_ERROR";
    if (result.response.status >= 400) return `HTTP_${result.response.status}`;
    return "OK";
}

/**
 * Convert an invocation result into a journal entry. Used when the request ran
 * through the CLI's in-process application without an active collector.
 */
export function entryFromInvocation(
    manifest: ProjectManifest,
    spec: DebugInvocationRequest,
    result: DebugInvocationResult,
): DebugJournalEntry {
    const route = manifest.routes.find(item =>
        item.method.toUpperCase() === spec.method.toUpperCase()
        && item.path === spec.path);
    const bodyCode = codeOf(result);
    const failed = result.response.status === 0
        || result.response.status >= 400
        || result.contract.input === "invalid"
        || result.contract.output === "invalid";
    return {
        schemaVersion: DEBUG_SCHEMA_VERSION,
        requestId: result.response.requestId,
        traceId: result.response.traceId,
        startedAt: new Date(Date.now() - Math.max(0, result.response.durationMs)).toISOString(),
        request: {
            method: result.request.method,
            route: result.request.path,
            pattern: route?.path ?? result.request.path,
            path: result.request.path,
            ...(result.request.query && Object.keys(result.request.query).length ? {query: result.request.query} : {}),
            ...(result.request.params && Object.keys(result.request.params).length ? {params: result.request.params} : {}),
            ...(result.request.headers && Object.keys(result.request.headers).length ? {headers: result.request.headers} : {}),
            ...(result.request.body !== undefined ? {body: result.request.body} : {}),
        },
        response: {
            status: result.response.status,
            durationMs: result.response.durationMs,
            ...(result.response.body !== undefined ? {body: result.response.body} : {}),
        },
        ...(sourceOf(route) ? {source: sourceOf(route)} : {}),
        timeline: [
            {
                step: "validation:input",
                result: result.contract.input === "invalid" ? "rejected" : result.contract.input === "absent" ? "absent" : "ok",
            },
            {
                step: "handler",
                result: result.contract.input === "invalid" ? "not-executed" : "ok",
            },
        ],
        ...(result.contract.input === "invalid"
            ? {
                validation: {
                    ok: false,
                    issues: result.contract.issues,
                },
            }
            : result.contract.issues.length
                ? {validation: {ok: true, issues: result.contract.issues}}
                : {}),
        ...(failed ? {
            error: {
                code: bodyCode,
                message: typeof (result.response.body as any)?.message === "string"
                    ? (result.response.body as any).message
                    : bodyCode,
                ...(result.response.status ? {statusCode: result.response.status} : {}),
            },
        } : {}),
        release: {hmr: false, buildId: "cli"},
        ...(result.replayedFrom ? {replayedFrom: result.replayedFrom} : {}),
    };
}

export function appendInvocationEntry(entry: DebugJournalEntry, workdir: string): void {
    appendSessionEntry(entry, workdir);
}
