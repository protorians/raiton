import type {PluginInterface} from "../../types/plugin.ts";
import type {ContextInterface} from "../../types/core.ts";
import type {PluginScope} from "../../core/plugins/scope.ts";
import {Logger} from "@protorians/logger";
import {metrics} from "./metrics.ts";
import {configureTraceExporter, parseTraceparent, traceparent, withSpan} from "./trace.ts";
import {readHeader, resolveRequestId} from "./request.ts";
import type {ObservabilityMode} from "../../types/config.ts";

export interface ObservabilityOptions {
    mode?: ObservabilityMode;
    metricsPath?: string;
    otelEndpoint?: string;
    requestIdHeader?: string;
    serviceName?: string;
}

interface ResolvedOptions {
    mode: ObservabilityMode;
    metricsPath: string;
    otelEndpoint: string;
    requestIdHeader: string;
    serviceName: string;
}

function resolveOptions(options: ObservabilityOptions): ResolvedOptions {
    const mode = options.mode ?? "off";
    return {
        mode,
        metricsPath: options.metricsPath || "/metrics",
        otelEndpoint: options.otelEndpoint || "",
        requestIdHeader: options.requestIdHeader || "x-request-id",
        serviceName: options.serviceName || "raiton",
    };
}

function shouldUseMetrics(mode: ObservabilityMode): boolean {
    return mode === "metrics" || mode === "all";
}

function shouldUseTraces(mode: ObservabilityMode): boolean {
    return mode === "traces" || mode === "all";
}

/**
 * Observability plugin.
 *
 * - `off`: the middleware is not registered at all.
 * - `metrics`: correlation id, Prometheus counters/histograms, `/metrics`.
 * - `traces`: correlation id, OTLP spans (incoming and `tracedFetch` outgoing).
 * - `all`: both.
 */
export function observabilityPlugin(options: ObservabilityOptions = {}): PluginInterface {
    const config = resolveOptions(options);

    return {
        name: "observability-plugin",
        setup: (scope: PluginScope) => {
            if (config.mode === "off") return;

            if (shouldUseTraces(config.mode) && config.otelEndpoint) {
                configureTraceExporter({
                    endpoint: config.otelEndpoint,
                    serviceName: config.serviceName,
                });
            }

            metrics.counter("http_requests_total", "Total HTTP requests");
            metrics.histogram("http_request_duration_seconds", "HTTP request duration in seconds");

            scope.use(async ({context, next}: any) => {
                const started = performance.now();
                const method = String(context.req?.method ?? "GET").toUpperCase();
                let requestId = context.state.requestId;

                if (!requestId) {
                    requestId = resolveRequestId(context.req, config.requestIdHeader);
                    context.state.requestId = requestId;
                    context.reply.header(config.requestIdHeader, requestId);
                }
                context.state.responseStatus = context.state.responseStatus ?? 200;

                const originalStatus = context.reply.status.bind(context.reply);
                context.reply.status = (code: number) => {
                    context.state.responseStatus = code;
                    return originalStatus(code);
                };

                try {
                    if (shouldUseTraces(config.mode)) {
                        const parent = parseTraceparent(readHeader(context.req?.headers, "traceparent"));
                        await withSpan(`HTTP ${method}`, async (span) => {
                            span.setAttribute("http.method", method);
                            span.setAttribute("http.request_id", requestId);
                            context.state.traceId = span.traceId;
                            context.state.spanId = span.spanId;
                            await next();
                        }, {
                            parent,
                            attributes: {http_method: method, request_id: requestId},
                        });
                    } else {
                        await next();
                    }
                } finally {
                    const status = Number(context.state.responseStatus ?? 200);
                    const route = context.state.matchedRoutePath ?? context.req?.url ?? "unknown";
                    const duration = (performance.now() - started) / 1000;

                    // Access logs are opt-in: they must not consume the
                    // observability performance budget. Error logs always
                    // carry the correlation id through the application.
                    if (process.env.RAITON_ACCESS_LOG === "1") {
                        Logger.info(
                            `[request] ${method} ${route} ${status} ${Math.round(duration * 1000)}ms ` +
                            `request_id=${requestId}` +
                            (context.state.traceId ? ` trace_id=${context.state.traceId}` : "")
                        );
                    }

                    if (shouldUseMetrics(config.mode)) {
                        metrics.increment("http_requests_total", {
                            method,
                            route,
                            status,
                        });
                        metrics.observe(
                            "http_request_duration_seconds",
                            duration,
                            {method, route},
                        );
                        if (status >= 500) {
                            metrics.increment("http_errors_total", {method, route, status});
                        }
                    }
                }
            });

            if (shouldUseMetrics(config.mode)) {
                const handler = async ({reply}: ContextInterface) => {
                    reply.type("text/plain; version=0.0.4; charset=utf-8");
                    return metrics.render();
                };
                (handler as any)._raitonInternal = true;
                scope.get(config.metricsPath, handler);
            }
        },
    };
}

export {traceparent};
