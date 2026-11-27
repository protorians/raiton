import {AsyncLocalStorage} from "node:async_hooks";

export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    sampled: boolean;
}

export interface TraceSpanOptions {
    attributes?: Record<string, any>;
    parent?: TraceContext;
}

const storage = new AsyncLocalStorage<TraceContext>();

let idCounter = 0;

function randomHex(bytes = 16): string {
    const cryptoObject: any = (globalThis as any).crypto;
    if (cryptoObject?.getRandomValues) {
        const array = new Uint8Array(bytes);
        cryptoObject.getRandomValues(array);
        return Array.from(array, value => value.toString(16).padStart(2, "0")).join("");
    }
    let output = "";
    for (let index = 0; index < bytes * 2; index++) {
        output += Math.floor(Math.random() * 16).toString(16);
    }
    return output;
}

export function generateTraceId(): string {
    return randomHex(16);
}

export function generateSpanId(): string {
    return randomHex(8);
}

export function currentTrace(): TraceContext | undefined {
    return storage.getStore();
}

export function parseTraceparent(value?: string | null): TraceContext | undefined {
    if (!value) return undefined;
    const [version, traceId, spanId, flags] = value.trim().split("-");
    if (version !== "00" || !traceId || traceId.length !== 32 || !spanId || spanId.length !== 16) return undefined;
    return {
        traceId,
        parentSpanId: spanId,
        spanId: generateSpanId(),
        sampled: (parseInt(flags ?? "01", 16) & 1) === 1,
    };
}

export function traceparent(context: TraceContext): string {
    return `00-${context.traceId}-${context.spanId}-${context.sampled ? "01" : "00"}`;
}

export class TraceSpan {
    public readonly traceId: string;
    public readonly spanId: string;
    public readonly parentSpanId?: string;
    public readonly name: string;
    public readonly startTime = Date.now();
    public readonly attributes: Record<string, any>;
    public readonly events: Array<{name: string; time: number; attributes?: Record<string, any>}> = [];
    public status: "unset" | "ok" | "error" = "unset";
    public error?: string;

    constructor(name: string, context: TraceContext, attributes: Record<string, any> = {}) {
        this.name = name;
        this.traceId = context.traceId;
        this.spanId = context.spanId;
        this.parentSpanId = context.parentSpanId;
        this.attributes = attributes;
    }

    setAttribute(key: string, value: any): this {
        this.attributes[key] = value;
        return this;
    }

    addEvent(name: string, attributes?: Record<string, any>): this {
        this.events.push({name, time: Date.now(), attributes});
        return this;
    }

    setStatus(status: "ok" | "error", error?: string): this {
        this.status = status;
        if (error) this.error = error;
        return this;
    }

    get durationMs(): number {
        return Date.now() - this.startTime;
    }

    context(): TraceContext {
        return {
            traceId: this.traceId,
            spanId: this.spanId,
            parentSpanId: this.parentSpanId,
            sampled: true,
        };
    }

    toOtlp(serviceName: string) {
        return {
            traceId: this.traceId,
            spanId: this.spanId,
            parentSpanId: this.parentSpanId,
            name: this.name,
            kind: 1,
            startTimeUnixNano: String(BigInt(this.startTime) * 1_000_000n),
            endTimeUnixNano: String(BigInt(this.startTime + this.durationMs) * 1_000_000n),
            attributes: Object.entries(this.attributes)
                .filter(([, value]) => value !== undefined && value !== null)
                .map(([key, value]) => ({
                    key,
                    value: typeof value === "number"
                        ? {doubleValue: value}
                        : typeof value === "boolean"
                            ? {boolValue: value}
                            : {stringValue: String(value)},
                })),
            events: this.events.map(event => ({
                name: event.name,
                timeUnixNano: String(BigInt(event.time) * 1_000_000n),
            })),
            status: this.status === "error"
                ? {code: 2, message: this.error ?? "error"}
                : {code: 1},
        };
    }
}

export interface TraceExporterOptions {
    endpoint?: string;
    serviceName?: string;
    headers?: Record<string, string>;
}

/**
 * Minimal OTLP/HTTP JSON exporter. Export is fire-and-forget so tracing never
 * blocks a request; failures are swallowed (tracing must not break the app).
 */
export class OtlpExporter {
    constructor(private readonly options: TraceExporterOptions = {}) {}

    export(span: TraceSpan): void {
        if (!this.options.endpoint) return;
        const payload = {
            resourceSpans: [{
                resource: {
                    attributes: [{key: "service.name", value: {stringValue: this.options.serviceName ?? "raiton"}}],
                },
                scopeSpans: [{
                    scope: {name: "raiton"},
                    spans: [span.toOtlp(this.options.serviceName ?? "raiton")],
                }],
            }],
        };

        const endpoint = this.options.endpoint.replace(/\/$/, "");
        const url = endpoint.endsWith("/v1/traces") ? endpoint : `${endpoint}/v1/traces`;

        try {
            void fetch(url, {
                method: "POST",
                headers: {"content-type": "application/json", ...(this.options.headers ?? {})},
                body: JSON.stringify(payload),
            }).catch(() => undefined);
        } catch {
            // Tracing is best-effort.
        }
    }
}

let defaultExporter = new OtlpExporter();

export function configureTraceExporter(options: TraceExporterOptions): void {
    defaultExporter = new OtlpExporter(options);
}

export function startSpan(name: string, options: TraceSpanOptions = {}): TraceSpan {
    const parent = options.parent ?? currentTrace();
    const context: TraceContext = {
        traceId: parent?.traceId ?? generateTraceId(),
        spanId: generateSpanId(),
        parentSpanId: parent?.spanId,
        sampled: parent?.sampled ?? true,
    };
    return new TraceSpan(name, context, options.attributes);
}

/**
 * Run a callback inside a trace. Nested spans share the trace id, which is how
 * incoming and outgoing operations are correlated.
 */
export async function withSpan<T>(
    name: string,
    callable: (span: TraceSpan) => Promise<T> | T,
    options: TraceSpanOptions = {},
): Promise<T> {
    const span = startSpan(name, options);
    try {
        const result = await storage.run(span.context(), () => callable(span));
        if (span.status === "unset") span.setStatus("ok");
        return result;
    } catch (error: any) {
        span.setStatus("error", error?.message ?? String(error));
        throw error;
    } finally {
        defaultExporter.export(span);
    }
}

/**
 * `fetch` wrapper that propagates the active trace and records an outgoing span.
 */
export async function tracedFetch(input: any, init: RequestInit = {}): Promise<Response> {
    const parent = currentTrace();
    const headers = new Headers(init.headers ?? {});

    return withSpan(
        `HTTP ${init.method ?? "GET"} ${typeof input === "string" ? input : (input?.url ?? "outgoing")}`,
        async (span) => {
            // The outgoing operation is the child span; propagate its context
            // so the remote service joins the same trace.
            headers.set("traceparent", traceparent(span.context()));
            span.setAttribute("http.method", init.method ?? "GET");
            const response = await fetch(input, {...init, headers});
            span.setAttribute("http.status_code", response.status);
            if (!response.ok) span.setStatus("error", `HTTP ${response.status}`);
            return response;
        },
        parent ? {parent} : {},
    );
}
