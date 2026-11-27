import type {ProjectManifest, ProjectRouteManifest} from "../manifest/schema.ts";
import type {ApplicationInterface} from "../types/application.ts";
import type {ResolvedDebugConfig} from "./types.ts";
import type {
    DebugVerificationReport,
    DebugVerificationResult,
} from "./types.ts";
import {DEBUG_SCHEMA_VERSION} from "./types.ts";
import {defaultExample, fillPathParams, type RouteExample} from "./examples.ts";
import {DebugInvocationError, invokeRoute, type InvocationContext} from "./invocation.ts";
import {matchStatus} from "./journal.ts";

const IDEMPOTENT = new Set(["GET", "HEAD", "OPTIONS"]);

export interface VerifyOptions {
    manifest: ProjectManifest;
    application?: ApplicationInterface;
    baseUrl?: string;
    config?: ResolvedDebugConfig;
    route?: string;
    allowUnsafe?: boolean;
    failOn?: string[];
    timeoutMs?: number;
    workdir?: string;
    headers?: Record<string, string>;
}

function exampleOf(route: ProjectRouteManifest): RouteExample {
    if (route.examples?.length) return fillPathParams(route.examples[0], route.path, route.paramsSchema);
    return fillPathParams(defaultExample({
        bodySchema: route.inputSchema,
        paramsSchema: route.paramsSchema,
        querySchema: route.querySchema,
        headersSchema: route.headersSchema,
        expectedStatus: 200,
    }), route.path, route.paramsSchema);
}

function sourceOf(route: ProjectRouteManifest): string | undefined {
    return route.file ? `${route.file}${route.line ? `:${route.line}` : ""}` : undefined;
}

function failureFromError(route: ProjectRouteManifest, error: unknown): DebugVerificationResult {
    if (error instanceof DebugInvocationError) {
        return {
            method: route.method,
            path: route.path,
            contract: "invalid",
            passed: false,
            reason: error.message,
            issue: error.hint,
            source: error.location ?? sourceOf(route),
        };
    }
    return {
        method: route.method,
        path: route.path,
        contract: "invalid",
        passed: false,
        reason: error instanceof Error ? error.message : String(error),
        source: sourceOf(route),
    };
}

/**
 * Call every route with its documented example, validate the status and output
 * contract, and return a per-route report. Non-idempotent methods are skipped
 * unless explicitly allowed.
 */
export async function verifyManifest(options: VerifyOptions): Promise<DebugVerificationReport> {
    const started = performance.now();
    const failOn = options.failOn ?? [];
    const context: InvocationContext = {
        manifest: options.manifest,
        application: options.application,
        config: options.config,
        baseUrl: options.baseUrl,
        workdir: options.workdir,
    };

    const selected = options.manifest.routes.filter(route =>
        !options.route || route.path.includes(options.route));

    const results: DebugVerificationResult[] = [];

    for (const route of selected) {
        const method = route.method.toUpperCase();
        if (!IDEMPOTENT.has(method) && !options.allowUnsafe) {
            results.push({
                method,
                path: route.path,
                contract: "skipped",
                passed: false,
                skipped: true,
                reason: "Non-idempotent method: pass --allow-unsafe to verify it explicitly.",
                source: sourceOf(route),
            });
            continue;
        }

        const example = exampleOf(route);
        const expectedStatus = example.expectedStatus ?? 200;

        try {
            const result = await invokeRoute(context, {
                method,
                path: route.path,
                params: example.params,
                query: example.query,
                headers: {...(example.headers ?? {}), ...(options.headers ?? {})},
                body: example.body,
                example: route.examples?.length ? example.name : undefined,
                timeoutMs: options.timeoutMs,
                baseUrl: options.baseUrl,
            });

            const statusMatches = result.response.status === expectedStatus;
            const failOnMatched = failOn.some(filter => matchStatus(result.response.status, filter));
            const inputValid = result.contract.input !== "invalid";
            const outputValid = result.contract.output !== "invalid";
            const passed = statusMatches && !failOnMatched && inputValid && outputValid;
            const issue = result.contract.issues[0];

            results.push({
                method,
                path: route.path,
                status: result.response.status,
                expectedStatus,
                contract: result.contract.output === "absent"
                    ? (result.contract.input === "absent" ? "absent" : "valid")
                    : (result.contract.output === "invalid" ? "invalid" : "valid"),
                passed,
                ...(issue ? {
                    issue: `${issue.path} ${issue.message}`,
                    field: issue.path,
                    expected: issue.expected,
                    actual: issue.received,
                } : !statusMatches ? {
                    issue: `expected status ${expectedStatus}, received ${result.response.status}`,
                } : failOnMatched ? {
                    issue: `status ${result.response.status} matched --fail-on`,
                } : {}),
                ...(sourceOf(route) ? {source: sourceOf(route)} : {}),
                requestId: result.response.requestId,
            });
        } catch (error) {
            results.push(failureFromError(route, error));
        }
    }

    const passed = results.filter(result => result.passed).length;
    const skipped = results.filter(result => result.skipped).length;
    const failed = results.length - passed - skipped;

    return {
        schemaVersion: DEBUG_SCHEMA_VERSION,
        summary: {
            routes: selected.length,
            passed,
            failed,
            skipped,
            durationMs: Math.round((performance.now() - started) * 100) / 100,
        },
        results,
    };
}

export function verifyHuman(report: DebugVerificationReport): string {
    const lines: string[] = [];
    lines.push(
        `Routes: ${report.summary.routes} · passed: ${report.summary.passed} · ` +
        `failed: ${report.summary.failed} · skipped: ${report.summary.skipped} ` +
        `(${report.summary.durationMs}ms)`,
    );
    for (const result of report.results) {
        const label = result.skipped ? "SKIP" : result.passed ? "PASS" : "FAIL";
        lines.push(
            `${label} ${result.method.padEnd(6)} ${result.path}` +
            (result.status !== undefined ? ` → ${result.status}` : "") +
            (result.issue ? ` — ${result.issue}` : "") +
            (result.reason ? ` — ${result.reason}` : "") +
            (result.source ? ` (${result.source})` : ""),
        );
    }
    return lines.join("\n");
}
