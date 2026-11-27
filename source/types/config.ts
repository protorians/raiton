import type {ArtifactsConfigInterface} from "./artifact.ts";
import type {HttpsConfigInput} from "../framework/utilities/https.util.ts";

export type ObservabilityMode = "off" | "metrics" | "traces" | "all";

export interface ObservabilityConfigInterface {
    /** Defaults to `off`: no metrics, no traces, no exporter. */
    mode?: ObservabilityMode;
    /** Prometheus exposition path. @default '/metrics' */
    metricsPath?: string;
    /** OTLP HTTP endpoint used when traces are enabled. */
    otelEndpoint?: string;
    /** Header carrying the correlation id. @default 'x-request-id' */
    requestIdHeader?: string;
    /** Service name attached to traces. */
    serviceName?: string;
}

export interface ValidationConfigInterface {
    /**
     * Output validation. `auto` enables it in development and disables it in
     * production. A boolean forces the value.
     * @default 'auto'
     */
    responses?: boolean | "auto";
}

export interface ShutdownConfigInterface {
    /** Maximum time spent draining in-flight requests. @default 10000 */
    timeoutMs?: number;
}

export interface DevPageConfigInterface {
    /** Mount the development page. Defaults to the HMR/dev mode. */
    enabled?: boolean;
    /** Page route. @default '/__dev' */
    path?: string;
}

export interface McpConfigInterface {
    /** Expose destructive tools. Defaults to false. */
    exposeDestructive?: boolean;
    /** Per-tool calls per minute. 0 disables the limiter. */
    rateLimitPerMinute?: number;
}

export type DebugCaptureMode = "off" | "metadata" | "full";

export interface DebugJournalConfigInterface {
    /** Capture requests in the bounded in-memory journal. */
    enabled?: boolean;
    /** Maximum number of retained entries. @default 1000 */
    capacity?: number;
    /** Maximum serialized body size, in bytes. @default 65536 */
    maxBodyBytes?: number;
    /** `off`, `metadata` (ids and scalars) or `full` (redacted bodies). */
    capture?: DebugCaptureMode;
    /** Entries older than this are evicted. @default 900000 */
    ttlMs?: number;
    /** Sampling rate between 0 and 1. @default 1 */
    sampleRate?: number;
    /** Additional sensitive keys, merged with the built-in list. */
    redact?: string[];
}

export interface DebugHttpConfigInterface {
    /** Mount the HTTP debug surface. */
    enabled?: boolean;
    /** Base path of the HTTP debug surface. @default '/__raiton' */
    basePath?: string;
    /** Only answer requests originating from the loopback interface. @default true */
    loopbackOnly?: boolean;
    /** Environment variable holding the debug token. @default 'RAITON_DEBUG_TOKEN' */
    tokenEnv?: string;
}

export interface DebugMcpConfigInterface {
    /** Mount the debug MCP server. */
    enabled?: boolean;
    /** MCP endpoint in application mode. @default '/__raiton/mcp' */
    path?: string;
}

export interface DebugReplayConfigInterface {
    /** Allow replaying non-idempotent methods without an explicit flag. */
    allowUnsafeMethods?: boolean;
}

export interface DebugConfigInterface {
    /**
     * Enable every debug surface. Defaults to `true` in development and
     * `false` otherwise; an explicit value always wins.
     */
    enabled?: boolean;
    journal?: DebugJournalConfigInterface;
    http?: DebugHttpConfigInterface;
    mcp?: DebugMcpConfigInterface;
    replay?: DebugReplayConfigInterface;
}

export interface ConfigurableInterface {
    rootDir: string;
    version: string;
    artifacts?: ArtifactsConfigInterface;
    port?: number;
    hostname?: string;
    protocole?: "http" | "https";
    pathname?: string;
    prefix?: string;
    develop?: boolean;
    verbose?: boolean;
    https?: HttpsConfigInput;
    observability?: ObservabilityConfigInterface;
    validation?: ValidationConfigInterface;
    shutdown?: ShutdownConfigInterface;
    devPage?: DevPageConfigInterface;
    mcp?: McpConfigInterface;
    /** AI-assisted runtime debug surfaces. Opt-in outside development. */
    debug?: DebugConfigInterface;
    /** Documentation generation options. */
    docs?: {
        dir?: string;
        lang?: "fr" | "en";
    };
}
