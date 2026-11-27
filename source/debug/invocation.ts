import type {ApplicationInterface} from "../types/application.ts";
import type {ProjectManifest, ProjectRouteManifest} from "../manifest/schema.ts";
import type {ResolvedDebugConfig} from "./types.ts";
import type {
    DebugContractStatus,
    DebugInvocationRequest,
    DebugInvocationResult,
    DebugResolvedRequest,
    DebugValidationIssue,
} from "./types.ts";
import {DEBUG_SCHEMA_VERSION} from "./types.ts";
import {generateRequestId} from "../framework/observability/request.ts";
import {DEFAULT_REDACT_KEYS, redactHeaders, redactValue, truncateValue} from "./redaction.ts";
import {exampleForSchema} from "./examples.ts";
import {sanitizeIssues} from "../contracts/errors.ts";
import type {DebugJournalEntry, DebugReplayComparison} from "./types.ts";

export class DebugInvocationError extends Error {
    public readonly code: string;
    public readonly hint: string;
    public readonly location?: string;
    public readonly exitCode: number;

    constructor(message: string, options: {
        code?: string;
        hint?: string;
        location?: string;
        exitCode?: number;
    } = {}) {
        super(message);
        this.name = "DebugInvocationError";
        this.code = options.code ?? "INVOCATION_FAILED";
        this.hint = options.hint ?? "Run `raiton routes` to inspect the mounted routes.";
        this.location = options.location;
        this.exitCode = options.exitCode ?? 1;
    }
}

export interface InvocationContext {
    manifest: ProjectManifest;
    application?: ApplicationInterface;
    config?: ResolvedDebugConfig;
    baseUrl?: string;
    workdir?: string;
    development?: boolean;
}

interface ResolvedRoute {
    route: ProjectRouteManifest;
    params: Record<string, any>;
}

function normalize(path: string): string {
    if (!path) return "/";
    let value = path.startsWith("/") ? path : `/${path}`;
    value = value.replace(/\/+/g, "/");
    if (value.length > 1) value = value.replace(/\/+$/, "");
    return value || "/";
}

function patternOf(routePath: string): RegExp {
    const escaped = normalize(routePath)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\\?:([A-Za-z0-9_]+)/g, "[^/]+");
    return new RegExp(`^${escaped}$`);
}

function paramNames(routePath: string): string[] {
    return [...normalize(routePath).matchAll(/:([A-Za-z0-9_]+)/g)].map(match => match[1]);
}

function splitPath(path: string): string {
    try {
        return new URL(path, "http://localhost").pathname;
    } catch {
        return path.split("?")[0];
    }
}

function appPrefix(application?: ApplicationInterface): string {
    const prefix = String((application as any)?.config?.prefix ?? "").replace(/\/+$/, "");
    return prefix && prefix !== "/" ? prefix : "";
}

function withoutPrefix(path: string, prefix: string): string {
    if (!prefix) return path;
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length) || "/";
    return path;
}

function matchRoute(manifest: ProjectManifest, method: string, path: string, application?: ApplicationInterface): ResolvedRoute | undefined {
    const prefix = appPrefix(application);
    const candidates = new Set<string>([normalize(splitPath(path))]);
    if (prefix) candidates.add(normalize(withoutPrefix(normalize(splitPath(path)), prefix)));

    const entryMethod = method.toUpperCase();
    const routes = manifest.routes.filter(route => route.method.toUpperCase() === entryMethod);

    for (const candidate of candidates) {
        const exact = routes.find(route => normalize(route.path) === candidate);
        if (exact) return {route: exact, params: {}};
    }

    for (const candidate of candidates) {
        for (const route of routes) {
            const pattern = patternOf(route.path);
            const match = pattern.exec(candidate);
            if (!match) continue;
            const names = paramNames(route.path);
            const params: Record<string, any> = {};
            names.forEach((name, index) => {
                params[name] = decodeURIComponent(match[index + 1]);
            });
            return {route, params};
        }
    }

    return undefined;
}

function fillPath(routePath: string, params: Record<string, any>): string {
    return normalize(routePath).replace(/:([A-Za-z0-9_]+)/g, (_: string, name: string) => {
        const value = params[name];
        return value === undefined ? `:${name}` : encodeURIComponent(String(value));
    });
}

function defaultBaseUrl(application?: ApplicationInterface): string {
    const app: any = application;
    const config = app?.config ?? {};
    const protocol = app?.https?.enabled ? "https" : (config.protocole || "http");
    const host = config.hostname && config.hostname !== "0.0.0.0" ? config.hostname : "localhost";
    const port = config.port ? `:${config.port}` : "";
    const pathname = config.pathname && config.pathname !== "/" ? config.pathname.replace(/\/+$/, "") : "";
    const prefix = config.prefix ? `/${String(config.prefix).replace(/^\/+|\/+$/g, "")}` : "";
    return `${protocol}://${host}${port}${pathname}${prefix}`;
}

function joinUrl(base: string, routePath: string, query: Record<string, any>): string {
    const root = base.replace(/\/+$/, "");
    const path = normalize(routePath);
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === null) continue;
        if (Array.isArray(value)) value.forEach(item => search.append(key, String(item)));
        else search.append(key, String(value));
    }
    const serialized = search.toString();
    return `${root}${path}${serialized ? `?${serialized}` : ""}`;
}

function issueFromValidation(issues: Array<{path?: string; code?: string; message?: string; expected?: string; received?: string; location?: string}>): DebugValidationIssue[] {
    return sanitizeIssues(issues as any[], {development: true}).map(issue => ({
        path: issue.path ? `/${issue.path.replace(/^\/+/, "")}` : "/",
        code: issue.code ?? "invalid_value",
        message: issue.message ?? "Invalid value",
        ...(issue.expected !== undefined ? {expected: issue.expected} : {}),
        ...(issue.received !== undefined ? {received: issue.received} : {}),
        ...(issue.location !== undefined ? {location: issue.location} : {}),
    }));
}

async function validatePart(schema: any, value: any, part: string): Promise<DebugValidationIssue[]> {
    if (!schema) return [];
    const {validateContract} = await import("../contracts/index.ts");
    const result = await validateContract(schema, value);
    if (result.success) return [];
    return issueFromValidation(result.issues).map(issue => ({
        ...issue,
        path: part ? `/${part}${issue.path === "/" ? "" : issue.path}` : issue.path,
    }));
}

export interface PreparedInvocation {
    resolved: DebugResolvedRequest;
    raw: {
        headers: Record<string, string>;
        query: Record<string, any>;
        params: Record<string, any>;
        body?: any;
    };
    route?: ProjectRouteManifest;
    contract: DebugContractStatus;
}

function redactionKeys(context: InvocationContext): string[] {
    return context.config?.journal.redact ?? [];
}

/**
 * Resolve and validate an invocation without sending it.
 */
export async function prepareInvocation(
    context: InvocationContext,
    spec: DebugInvocationRequest,
): Promise<PreparedInvocation> {
    const method = String(spec.method || "GET").toUpperCase();
    let routePath = spec.path;
    let inlineQuery: Record<string, string> = {};
    try {
        const parsed = new URL(String(spec.path || "/"), "http://localhost");
        routePath = parsed.pathname;
        inlineQuery = Object.fromEntries(parsed.searchParams.entries());
    } catch {
        routePath = splitPath(spec.path);
    }

    let route: ProjectRouteManifest | undefined;
    let params: Record<string, any> = {};

    if (spec.example) {
        const exampleRoute = matchRoute(context.manifest, method, routePath, context.application);
        const candidate = exampleRoute?.route ?? context.manifest.routes.find(item =>
            item.method.toUpperCase() === method && normalize(item.path) === normalize(routePath));
        const example = candidate?.examples?.find(item => item.name === spec.example);
        if (!candidate || !example) {
            throw new DebugInvocationError(
                `Example '${spec.example}' not found for ${method} ${routePath}`,
                {
                    code: "EXAMPLE_NOT_FOUND",
                    hint: candidate?.examples?.length
                        ? `Available examples: ${candidate.examples.map(item => item.name).join(", ")}.`
                        : "Declare an example with @Example() or omit --example to use the generated one.",
                },
            );
        }
        route = candidate;
        params = {...(example.params ?? {}), ...(spec.params ?? {})};
        spec = {
            ...spec,
            body: spec.body === undefined ? example.body : spec.body,
            query: {...(example.query ?? {}), ...(spec.query ?? {})},
            headers: {...(example.headers ?? {}), ...(spec.headers ?? {})},
            path: candidate.path,
        };
        routePath = candidate.path;
    }

    const matched = matchRoute(context.manifest, method, routePath, context.application);
    if (matched) {
        route = matched.route;
        params = {...matched.params, ...params, ...(spec.params ?? {})};
        routePath = matched.route.path;
    } else if (route) {
        params = {...params, ...(spec.params ?? {})};
    } else {
        const {suggestRoute} = await import("../framework/utilities/route-suggestion.util.ts");
        const suggestion = suggestRoute(context.manifest.routes, method, splitPath(routePath));
        throw new DebugInvocationError(
            `Route ${method} ${splitPath(routePath)} was not registered`,
            {
                code: "ROUTE_NOT_FOUND",
                hint: suggestion
                    ? `Did you mean ${suggestion}? Run \`raiton routes\` to list every mounted route.`
                    : "Run `raiton routes` to list every mounted route.",
            },
        );
    }

    const names = paramNames(route.path);
    const missing = names.filter(name => params[name] === undefined || params[name] === null || params[name] === "");
    if (missing.length) {
        const expected = route.path.replace(/:([A-Za-z0-9_]+)/g, (_: string, name: string) =>
            missing.includes(name) ? `{${name}}` : `{${name}}`);
        throw new DebugInvocationError(
            `Missing path parameter(s): ${missing.join(", ")}`,
            {
                code: "MISSING_PATH_PARAMETER",
                hint: `Expected path: ${expected}. Provide ${missing.map(name => `--param ${name}=<value>`).join(" ")}.`,
                location: route.file ? `${route.file}:${route.line}` : undefined,
            },
        );
    }

    const query = {...inlineQuery, ...(spec.query ?? {})};
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(spec.headers ?? {})) {
        if (value === undefined || value === null) continue;
        headers[key.toLowerCase()] = String(value);
    }
    const body = spec.body;
    if (body !== undefined && !Object.keys(headers).some(key => key === "content-type")) {
        headers["content-type"] = "application/json";
    }
    if (spec.baseUrl) headers.accept ??= "application/json";

    const issues: DebugValidationIssue[] = [];
    let inputStatus: DebugContractStatus["input"] = "absent";
    if (route?.inputSchema || route?.querySchema || route?.paramsSchema || route?.headersSchema) {
        inputStatus = "valid";
        if (route.inputSchema) {
            issues.push(...await validatePart(route.inputSchema, body, "body"));
        }
        if (route.querySchema) {
            issues.push(...await validatePart(route.querySchema, query, "query"));
        }
        if (route.paramsSchema) {
            issues.push(...await validatePart(route.paramsSchema, params, "params"));
        }
        if (route.headersSchema) {
            issues.push(...await validatePart(route.headersSchema, headers, "headers"));
        }
        if (issues.length) inputStatus = "invalid";
    }
    if (spec.validate === false) inputStatus = "skipped";

    const resolvedPath = fillPath(route.path, params);
    const baseUrl = spec.baseUrl ?? defaultBaseUrl(context.application);
    const url = joinUrl(baseUrl, resolvedPath, query);

    const keys = redactionKeys(context);
    const resolved: DebugResolvedRequest = {
        method,
        path: resolvedPath,
        url,
        params,
        query,
        headers: redactHeaders(headers, keys),
        ...(body !== undefined ? {body: redactValue(body, {keys})} : {}),
    };

    return {
        resolved,
        raw: {
            headers,
            query,
            params,
            ...(body !== undefined ? {body} : {}),
        },
        route,
        contract: {
            input: inputStatus,
            output: route?.outputSchema ? "unknown" : "absent",
            issues,
            route: `${method} ${route.path}`,
        },
    };
}

interface MockReply {
    statusCode: number;
    headers: Record<string, string>;
    body?: any;
    status(code: number): MockReply;
    header(name: string, value: any): MockReply;
    send(body: any): void;
    json(body: any): void;
    type(value: string): MockReply;
}

function mockReply(): MockReply {
    const reply: MockReply = {
        statusCode: 200,
        headers: {},
        body: undefined,
        status(code: number) {
            reply.statusCode = code;
            return reply;
        },
        header(name: string, value: any) {
            reply.headers[name.toLowerCase()] = String(value);
            return reply;
        },
        send(body: any) {
            reply.body = body;
        },
        json(body: any) {
            reply.body = body;
        },
        type() {
            return reply;
        },
    };
    return reply;
}

function parseTraceparent(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const match = value.trim().match(/^[0-9a-f]{2}-([0-9a-f]{32})-/i);
    return match?.[1];
}

function readHeader(headers: any, name: string): string | undefined {
    if (!headers) return undefined;
    if (typeof headers.get === "function") return headers.get(name) ?? undefined;
    const lower = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lower && value !== undefined) return String(value);
    }
    return undefined;
}

async function executeInProcess(
    application: ApplicationInterface,
    prepared: PreparedInvocation,
    timeoutMs: number,
): Promise<{status: number; body: any; headers: Record<string, string>; durationMs: number}> {
    const reply = mockReply();
    const headers = new Headers();
    for (const [key, value] of Object.entries(prepared.raw.headers ?? {})) {
        headers.set(key, String(value));
    }

    const url = prepared.resolved.url.includes("://")
        ? new URL(prepared.resolved.url).pathname + new URL(prepared.resolved.url).search
        : prepared.resolved.url;

    const req: any = {
        method: prepared.resolved.method,
        url,
        headers,
        body: prepared.raw.body,
    };

    const started = performance.now();
    let timer: any;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DebugInvocationError(
            `Invocation timed out after ${timeoutMs}ms`,
            {
                code: "INVOCATION_TIMEOUT",
                hint: "Raise --timeout or check that the handler is not blocked.",
                exitCode: 2,
            },
        )), timeoutMs);
        (timer as any)?.unref?.();
    });

    try {
        await Promise.race([
            (application as any).handle(req, reply),
            timeout,
        ]);
    } finally {
        clearTimeout(timer);
    }

    return {
        status: reply.statusCode,
        body: reply.body,
        headers: reply.headers,
        durationMs: performance.now() - started,
    };
}

async function executeOverHttp(
    prepared: PreparedInvocation,
    timeoutMs: number,
): Promise<{status: number; body: any; headers: Record<string, string>; durationMs: number}> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    (timer as any)?.unref?.();
    const started = performance.now();

    try {
        const response = await fetch(prepared.resolved.url, {
            method: prepared.resolved.method,
            headers: prepared.raw.headers as any,
            ...(prepared.raw.body !== undefined && prepared.resolved.method !== "GET" && prepared.resolved.method !== "HEAD"
                ? {body: typeof prepared.raw.body === "string" ? prepared.raw.body : JSON.stringify(prepared.raw.body)}
                : {}),
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
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
        });
        return {status: response.status, body, headers, durationMs: performance.now() - started};
    } catch (error: any) {
        if (error?.name === "AbortError") {
            throw new DebugInvocationError(
                `Invocation timed out after ${timeoutMs}ms`,
                {
                    code: "INVOCATION_TIMEOUT",
                    hint: "Raise --timeout or verify the target application is responsive.",
                    exitCode: 2,
                },
            );
        }
        throw new DebugInvocationError(
            `Cannot reach ${prepared.resolved.url}: ${error?.message ?? error}`,
            {
                code: "CONNECTION_FAILED",
                hint: "Start the application or pass --url <base> to target a running instance.",
                exitCode: 2,
            },
        );
    } finally {
        clearTimeout(timer);
    }
}

function nextActions(method: string, path: string, requestId?: string, exampleName?: string): string[] {
    const actions: string[] = [];
    if (requestId) actions.push(`raiton explain ${requestId}`);
    if (exampleName) actions.push(`raiton call ${method} ${path} --example ${exampleName}`);
    else actions.push(`raiton call ${method} ${path} --dry-run`);
    return actions;
}

/**
 * Resolve, validate, send and normalize a route invocation. Input validation
 * runs before any handler execution; an invalid payload is never sent.
 */
export async function invokeRoute(
    context: InvocationContext,
    spec: DebugInvocationRequest,
): Promise<DebugInvocationResult> {
    const prepared = await prepareInvocation(context, spec);
    const requestId = generateRequestId();
    const timeoutMs = Number.isFinite(spec.timeoutMs) ? Number(spec.timeoutMs) : 10_000;
    const keys = redactionKeys(context);
    const maxBodyBytes = context.config?.journal.maxBodyBytes ?? 65_536;

    if (prepared.contract.input === "invalid") {
        return {
            schemaVersion: DEBUG_SCHEMA_VERSION,
            request: {
                method: prepared.resolved.method,
                path: prepared.resolved.path,
                url: prepared.resolved.url,
                headers: prepared.resolved.headers,
                query: prepared.resolved.query,
                ...(Object.keys(prepared.resolved.params ?? {}).length ? {params: prepared.resolved.params} : {}),
                ...(prepared.resolved.body !== undefined ? {body: prepared.resolved.body} : {}),
                dryRun: true,
            },
            response: {
                status: 0,
                durationMs: 0,
                requestId,
                traceId: generateTraceId(),
            },
            contract: {...prepared.contract, output: "unknown"},
            nextActions: [
                `raiton call ${prepared.resolved.method} ${prepared.resolved.path} --dry-run`,
                ...(prepared.route?.examples?.length ? [`raiton call ${prepared.resolved.method} ${prepared.resolved.path} --example ${prepared.route.examples[0].name}`] : []),
            ],
        };
    }

    if (spec.dryRun) {
        return {
            schemaVersion: DEBUG_SCHEMA_VERSION,
            request: {
                method: prepared.resolved.method,
                path: prepared.resolved.path,
                url: prepared.resolved.url,
                headers: prepared.resolved.headers,
                query: prepared.resolved.query,
                ...(Object.keys(prepared.resolved.params ?? {}).length ? {params: prepared.resolved.params} : {}),
                ...(prepared.resolved.body !== undefined ? {body: prepared.resolved.body} : {}),
                dryRun: true,
            },
            response: {
                status: 0,
                durationMs: 0,
                requestId,
                traceId: generateTraceId(),
            },
            contract: {...prepared.contract, output: "unknown"},
            nextActions: nextActions(prepared.resolved.method, prepared.resolved.path, undefined, spec.example),
        };
    }

    const executed = context.baseUrl && !context.application
        ? await executeOverHttp(prepared, timeoutMs)
        : context.application
            ? await executeInProcess(context.application, prepared, timeoutMs)
            : await executeOverHttp(prepared, timeoutMs);

    let outputStatus: DebugContractStatus["output"] = "absent";
    const outputIssues: DebugValidationIssue[] = [];
    if (prepared.route?.outputSchema) {
        outputStatus = "valid";
        const {validateContract} = await import("../contracts/index.ts");
        const result = await validateContract(prepared.route.outputSchema as any, executed.body);
        if (!result.success) {
            outputStatus = "invalid";
            outputIssues.push(...issueFromValidation(result.issues));
        }
    }

    const responseRequestId = readHeader(executed.headers, "x-request-id") ?? requestId;
    const responseTraceId = parseTraceparent(readHeader(executed.headers, "traceparent"))
        ?? readHeader(executed.headers, "x-trace-id")
        ?? generateTraceId();

    return {
        schemaVersion: DEBUG_SCHEMA_VERSION,
        request: {
            method: prepared.resolved.method,
            path: prepared.resolved.path,
            url: prepared.resolved.url,
            headers: prepared.resolved.headers,
            query: prepared.resolved.query,
                ...(Object.keys(prepared.resolved.params ?? {}).length ? {params: prepared.resolved.params} : {}),
            ...(prepared.resolved.body !== undefined ? {body: prepared.resolved.body} : {}),
        },
        response: {
            status: executed.status,
            durationMs: Math.round(executed.durationMs * 100) / 100,
            requestId: responseRequestId,
            traceId: responseTraceId,
            ...(executed.body !== undefined
                ? {body: truncateValue(redactValue(executed.body, {keys}), maxBodyBytes)}
                : {}),
        },
        contract: {
            input: prepared.contract.input,
            output: outputStatus,
            issues: [...prepared.contract.issues, ...outputIssues],
            ...(prepared.contract.route ? {route: prepared.contract.route} : {}),
        },
        nextActions: nextActions(
            prepared.resolved.method,
            prepared.resolved.path,
            responseRequestId,
            spec.example,
        ),
        ...(spec.replayedFrom ? {replayedFrom: spec.replayedFrom} : {}),
    };
}

function generateTraceId(): string {
    let output = "";
    while (output.length < 32) {
        output += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
    }
    return output.slice(0, 32);
}

function stableStringify(value: any): string | undefined {
    if (value === undefined) return undefined;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * Compare a replay with the original journal entry. Captured bodies may be
 * absent in metadata mode, in which case the body comparison is `unknown`.
 */
export function compareReplay(
    previous: DebugJournalEntry,
    result: DebugInvocationResult,
): DebugReplayComparison {
    const differences: string[] = [];
    const previousStatus = previous.response.status;
    const currentStatus = result.response.status;
    if (previousStatus !== currentStatus) {
        differences.push(`status: ${previousStatus} → ${currentStatus}`);
    }

    const previousCode = previous.error?.code;
    const currentCode = (result.response.body as any)?.code;
    if (previousCode && currentCode && previousCode !== currentCode) {
        differences.push(`error code: ${previousCode} → ${currentCode}`);
    }

    const previousIssues = (previous.validation?.issues ?? []).map(issue => issue.path).sort().join(",");
    const currentIssues = (result.contract.issues ?? []).map(issue => issue.path).sort().join(",");
    if (previousIssues !== currentIssues) {
        differences.push(`validation fields: [${previousIssues}] → [${currentIssues}]`);
    }

    const previousBody = stableStringify(previous.response.body);
    const currentBody = stableStringify(result.response.body);
    const body = previousBody === undefined || currentBody === undefined
        ? "unknown"
        : previousBody === currentBody ? "same" : "changed";
    if (body === "changed") differences.push("response body changed");

    return {
        status: previousStatus === currentStatus ? "same" : "changed",
        body,
        previousStatus,
        currentStatus,
        differences,
    };
}

export {DEFAULT_REDACT_KEYS, exampleForSchema};
