import type {ContractIssue} from "../contracts/index.ts";
import {generateRequestId} from "../framework/observability/request.ts";
import {
    headersToObject,
    redactHeaders,
    redactValue,
    summarizeValue,
    truncateValue,
} from "./redaction.ts";
import type {
    DebugJournal,
} from "./journal.ts";
import type {
    DebugErrorLike,
    DebugTraceState,
} from "./collector.internal.ts";
import type {ResolvedDebugConfig} from "./types.ts";
import {DEBUG_SCHEMA_VERSION} from "./types.ts";
import type {
    DebugJournalEntry,
    DebugRouteSource,
    DebugValidationIssue,
    DebugValidationSummary,
} from "./types.ts";

export interface DebugCollectorOptions {
    config: ResolvedDebugConfig;
    journal: DebugJournal;
    buildId: string;
    development: boolean;
}

function randomHex(length: number): string {
    let output = "";
    while (output.length < length) {
        output += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    }
    return output.slice(0, length);
}

function traceId(): string {
    return randomHex(32);
}

function nowIso(): string {
    return new Date().toISOString();
}

function pathnameOf(ctx: any): string {
    const cached = ctx?.state?.url;
    if (cached && typeof cached.pathname === "string") return cached.pathname;
    try {
        return new URL(String(ctx?.req?.url ?? "/"), "http://localhost").pathname;
    } catch {
        return String(ctx?.req?.url ?? "/");
    }
}

function queryOf(ctx: any): Record<string, any> {
    const direct = ctx?.req?.query;
    if (direct && typeof direct === "object") return {...direct};
    try {
        const url = new URL(String(ctx?.req?.url ?? "/"), "http://localhost");
        return Object.fromEntries(url.searchParams.entries());
    } catch {
        return {};
    }
}

/** Convert contract issues to the journal/explanation shape. */
export function toDebugIssues(issues: ContractIssue[] | undefined, redact: string[] = []): DebugValidationIssue[] {
    if (!Array.isArray(issues)) return [];
    return issues.map(issue => ({
        path: issue.path || "/",
        code: issue.code || "invalid_value",
        message: issue.message || "Invalid value",
        ...(issue.expected !== undefined ? {expected: issue.expected} : {}),
        ...(issue.received !== undefined
            ? {received: isSensitivePath(issue.path, redact) ? "***" : issue.received}
            : {}),
        ...(issue.location ? {location: issue.location} : {}),
    }));
}

function isSensitivePath(path: string, extra: string[]): boolean {
    const segment = String(path ?? "").split(/[./[\]]/).filter(Boolean).pop()?.toLowerCase() ?? "";
    if (!segment) return false;
    const keys = new Set([
        "authorization", "cookie", "password", "secret", "token", "access_token",
        "refresh_token", "api_key", "apikey", "x-api-key", ...extra.map(key => key.toLowerCase()),
    ]);
    return keys.has(segment);
}

/**
 * Request-scoped collector.
 *
 * `start()` allocates one trace only when the journal is enabled. Disabled
 * debug surfaces never call this class at all (see `runtime.ts`).
 */
export class DebugCollector {
    buildId: string;
    readonly config: ResolvedDebugConfig;
    readonly journal: DebugJournal;
    private readonly development: boolean;

    constructor(options: DebugCollectorOptions) {
        this.config = options.config;
        this.journal = options.journal;
        this.buildId = options.buildId;
        this.development = options.development;
    }

    get enabled(): boolean {
        return this.config.journal.enabled && this.config.journal.capture !== "off";
    }

    start(ctx: any): void {
        if (!this.enabled) return;
        try {
            if (this.config.journal.sampleRate < 1 && Math.random() > this.config.journal.sampleRate) return;
            if (!ctx.state.traceId) ctx.state.traceId = traceId();
            const state: DebugTraceState = {
                startedAt: nowIso(),
                startPerf: performance.now(),
                requestId: ctx.state.requestId || generateRequestId(),
                traceId: ctx.state.traceId,
                method: String(ctx.req?.method ?? "GET").toUpperCase(),
                pathname: pathnameOf(ctx),
                timeline: [],
                handlerExecuted: false,
                validation: undefined,
                error: undefined,
                source: undefined,
                cache: undefined,
                responseBody: undefined,
                captured: true,
            };
            ctx.state.requestId = state.requestId;
            ctx.state.debug = state;
        } catch {
            // A capture failure must never affect the request.
        }
    }

    step(ctx: any, step: string, result?: string, durationMs?: number, detail?: string): void {
        const state = this.state(ctx);
        if (!state) return;
        state.timeline.push({
            step,
            ...(durationMs !== undefined ? {durationMs: round(durationMs)} : {}),
            ...(result ? {result} : {}),
            ...(detail ? {detail} : {}),
        });
    }

    markHandler(ctx: any, executed: boolean): void {
        const state = this.state(ctx);
        if (state) state.handlerExecuted = executed;
    }

    setSource(ctx: any, source: DebugRouteSource | undefined): void {
        const state = this.state(ctx);
        if (state && source) state.source = source;
    }

    setValidation(ctx: any, summary: DebugValidationSummary | undefined): void {
        const state = this.state(ctx);
        if (state) state.validation = summary;
    }

    setCache(ctx: any, hit: boolean): void {
        const state = this.state(ctx);
        if (state) state.cache = {hit};
    }

    setError(ctx: any, error: DebugErrorLike | undefined): void {
        const state = this.state(ctx);
        if (state && error) state.error = error;
    }

    setResponseBody(ctx: any, body: any): void {
        const state = this.state(ctx);
        if (state) state.responseBody = body;
    }

    setStatus(ctx: any, status: number): void {
        if (ctx?.state) ctx.state.responseStatus = status;
    }

    finish(ctx: any): DebugJournalEntry | undefined {
        const state = this.state(ctx);
        if (!state) return undefined;
        state.captured = false;
        try {
            const status = Number(ctx.state?.responseStatus ?? inferStatus(state.responseBody) ?? 200);
            const durationMs = performance.now() - state.startPerf;
            const full = this.config.journal.capture === "full";
            const maxBytes = this.config.journal.maxBodyBytes;
            const extra = this.config.journal.redact;

            const query = queryOf(ctx);
            const params = ctx?.params ?? ctx?.req?.params ?? {};
            const headers = headersToObject(ctx.req?.headers);
            const isBodyMethod = state.method !== "GET" && state.method !== "HEAD";
            const requestBody = isBodyMethod ? ctx.req?.body : undefined;

            const entry: DebugJournalEntry = {
                schemaVersion: DEBUG_SCHEMA_VERSION,
                requestId: state.requestId,
                traceId: state.traceId,
                startedAt: state.startedAt,
                request: {
                    method: state.method,
                    route: state.pathname,
                    pattern: String(ctx.state?.matchedRoutePath ?? state.pathname),
                    path: state.pathname,
                    ...(full && Object.keys(query).length ? {query: redactValue(query, {keys: extra})} : {}),
                    ...(full && Object.keys(params).length ? {params: redactValue(params, {keys: extra})} : {}),
                    ...(full && Object.keys(headers).length ? {headers: redactHeaders(headers, extra)} : {}),
                    ...(full && requestBody !== undefined
                        ? {body: truncateValue(redactValue(requestBody, {keys: extra}), maxBytes)}
                        : {}),
                },
                response: {
                    status,
                    durationMs: round(durationMs),
                    ...(full && state.responseBody !== undefined
                        ? {body: truncateValue(redactValue(state.responseBody, {keys: extra}), maxBytes)}
                        : {}),
                },
                ...(state.source ? {source: state.source} : {}),
                timeline: state.timeline.length
                    ? state.timeline
                    : [{step: "handler", result: state.handlerExecuted ? "ok" : "not-executed"}],
                ...(state.validation ? {validation: state.validation} : {}),
                ...(state.error ? {
                    error: {
                        code: state.error.code,
                        message: state.error.message,
                        ...(state.error.statusCode !== undefined ? {statusCode: state.error.statusCode} : {}),
                        ...(this.development && state.error.stack ? {stack: state.error.stack} : {}),
                        ...(this.development && state.error.location ? {location: state.error.location} : {}),
                    },
                } : {}),
                ...(state.cache ? {cache: state.cache} : {}),
                release: {
                    hmr: Boolean(this.development),
                    buildId: this.buildId,
                },
            };

            this.journal.push(entry, full ? undefined : 512);
            return entry;
        } catch {
            return undefined;
        } finally {
            // Release request-scoped references so nothing outlives the request
            // through the context.
            try {
                const current = ctx.state?.debug;
                if (current) {
                    current.responseBody = undefined;
                    current.captured = false;
                }
            } catch {
                // Ignore.
            }
        }
    }

    ack(ctx: any): void {
        const state = this.state(ctx);
        if (state) state.captured = false;
    }

    private state(ctx: any): DebugTraceState | undefined {
        if (!this.enabled) return undefined;
        const state = ctx?.state?.debug as DebugTraceState | undefined;
        return state?.captured ? state : undefined;
    }
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}

function inferStatus(body: any): number | undefined {
    if (body && typeof body === "object" && typeof body.statusCode === "number") return body.statusCode;
    return undefined;
}

// Re-export the summary helper for callers that only have a raw value.
export {summarizeValue};
