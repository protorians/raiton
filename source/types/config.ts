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
    /** Documentation generation options. */
    docs?: {
        dir?: string;
        lang?: "fr" | "en";
    };
}
