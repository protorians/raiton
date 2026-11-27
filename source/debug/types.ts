import type {
    DebugCaptureMode,
    DebugConfigInterface,
    DebugJournalConfigInterface,
} from "../types/config.ts";

/** Version of every debug artefact (journal, invocation, explanation, report). */
export const DEBUG_SCHEMA_VERSION = "1.0.0";
export const SUPPORTED_DEBUG_SCHEMA_VERSIONS = new Set([DEBUG_SCHEMA_VERSION]);

export function isSupportedDebugSchemaVersion(version: unknown): boolean {
    return typeof version === "string" && SUPPORTED_DEBUG_SCHEMA_VERSIONS.has(version);
}

export class DebugSchemaVersionError extends Error {
    constructor(public readonly version: unknown) {
        super(
            `Unsupported debug schema version: ${String(version)}. ` +
            `Supported: ${[...SUPPORTED_DEBUG_SCHEMA_VERSIONS].join(", ")}.`,
        );
        this.name = "DebugSchemaVersionError";
        this.code = "UNSUPPORTED_SCHEMA_VERSION";
    }

    public readonly code: string;
}

export type DebugCapture = DebugCaptureMode;

export interface ResolvedDebugJournalConfig {
    enabled: boolean;
    capacity: number;
    maxBodyBytes: number;
    capture: DebugCapture;
    ttlMs: number;
    sampleRate: number;
    redact: string[];
    /** Hard budget for the whole journal, in bytes. @default 8388608 */
    maxTotalBytes: number;
}

export interface ResolvedDebugHttpConfig {
    enabled: boolean;
    basePath: string;
    loopbackOnly: boolean;
    tokenEnv: string;
    token?: string;
}

export interface ResolvedDebugMcpConfig {
    enabled: boolean;
    path: string;
}

export interface ResolvedDebugConfig {
    enabled: boolean;
    journal: ResolvedDebugJournalConfig;
    http: ResolvedDebugHttpConfig;
    mcp: ResolvedDebugMcpConfig;
    replay: {allowUnsafeMethods: boolean};
    development: boolean;
    raw: DebugConfigInterface;
}

export interface DebugRouteSource {
    file: string;
    line: number;
    controller: string;
    handler: string;
    decorator?: string;
}

export interface DebugTimelineStep {
    step: string;
    durationMs?: number;
    result?: string;
    detail?: string;
}

export interface DebugValidationIssue {
    path: string;
    code: string;
    message: string;
    expected?: string;
    received?: string;
    location?: string;
}

export interface DebugValidationSummary {
    ok: boolean;
    absent?: boolean;
    issues: DebugValidationIssue[];
}

export interface DebugJournalRequest {
    method: string;
    route: string;
    pattern: string;
    path: string;
    query?: Record<string, any>;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    body?: any;
}

export interface DebugJournalResponse {
    status: number;
    durationMs: number;
    body?: any;
}

export interface DebugJournalError {
    code: string;
    message: string;
    statusCode?: number;
    stack?: string[];
    location?: string;
}

export interface DebugRelease {
    hmr: boolean;
    buildId: string;
}

export interface DebugJournalEntry {
    schemaVersion: string;
    requestId: string;
    traceId: string;
    startedAt: string;
    request: DebugJournalRequest;
    response: DebugJournalResponse;
    source?: DebugRouteSource;
    timeline: DebugTimelineStep[];
    validation?: DebugValidationSummary;
    error?: DebugJournalError;
    cache?: {hit: boolean};
    release: DebugRelease;
    replayedFrom?: string;
    stale?: boolean;
}

export interface DebugJournalFilter {
    sinceMs?: number;
    status?: string;
    route?: string;
    limit?: number;
    includeBodies?: boolean;
}

export interface DebugRequestsList {
    schemaVersion: string;
    count: number;
    capacity: number;
    enabled: boolean;
    requests: Array<{
        requestId: string;
        traceId: string;
        startedAt: string;
        method: string;
        route: string;
        status: number;
        durationMs: number;
        stale?: boolean;
    }>;
}

export interface DebugInvocationRequest {
    method: string;
    path: string;
    params?: Record<string, any>;
    query?: Record<string, any>;
    headers?: Record<string, any>;
    body?: any;
    example?: string;
    dryRun?: boolean;
    validate?: boolean;
    timeoutMs?: number;
    baseUrl?: string;
    failOn?: string[];
    replayedFrom?: string;
}

export interface DebugResolvedRequest {
    method: string;
    path: string;
    url: string;
    params: Record<string, any>;
    query: Record<string, any>;
    headers: Record<string, string>;
    body?: any;
}

export interface DebugContractStatus {
    input: "valid" | "invalid" | "absent" | "skipped";
    output: "valid" | "invalid" | "absent" | "unknown";
    issues: DebugValidationIssue[];
    /** Route label used to attribute output contract violations. */
    route?: string;
}

export interface DebugInvocationResult {
    schemaVersion: string;
    request: {
        method: string;
        path: string;
        url?: string;
        headers: Record<string, string>;
        query?: Record<string, any>;
        params?: Record<string, any>;
        body?: any;
        dryRun?: boolean;
    };
    response: {
        status: number;
        durationMs: number;
        requestId: string;
        traceId: string;
        body?: any;
    };
    contract: DebugContractStatus;
    nextActions: string[];
    replayedFrom?: string;
    comparison?: DebugReplayComparison;
}

export interface DebugReplayComparison {
    status: "same" | "changed";
    body: "same" | "changed" | "unknown";
    previousStatus: number;
    currentStatus: number;
    differences: string[];
}

export interface DebugExplanation {
    schemaVersion: string;
    requestId: string;
    request: {
        method: string;
        route: string;
        status: number;
        durationMs: number;
        startedAt: string;
    };
    source?: DebugRouteSource;
    timeline: DebugTimelineStep[];
    diagnosis: {
        code: string;
        rootCause: string;
        issues: DebugValidationIssue[];
        hint: string;
        /** Development-only launch site. */
        location?: string;
        /** Development-only stack lines. */
        stack?: string[];
    };
    nextActions: string[];
    stale?: boolean;
    request_verbose?: DebugJournalRequest;
    response_verbose?: DebugJournalResponse;
}

export interface DebugVerificationResult {
    method: string;
    path: string;
    status?: number;
    expectedStatus?: number;
    contract: "valid" | "invalid" | "absent" | "skipped";
    passed: boolean;
    skipped?: boolean;
    reason?: string;
    issue?: string;
    field?: string;
    expected?: string;
    actual?: string;
    source?: string;
    requestId?: string;
}

export interface DebugVerificationReport {
    schemaVersion: string;
    summary: {
        routes: number;
        passed: number;
        failed: number;
        skipped: number;
        durationMs: number;
    };
    results: DebugVerificationResult[];
}

export interface DebugDoctorCheck {
    name: string;
    passed: boolean;
    detail?: string;
    hint?: string;
}

export interface DebugDoctorReport {
    schemaVersion: string;
    passed: boolean;
    checks: DebugDoctorCheck[];
}

export interface DebugLogLine {
    at: string;
    level: string;
    message: string;
}

/** Loose config accepted by `defineConfig`; kept for editor completion. */
export type {DebugConfigInterface, DebugJournalConfigInterface};
