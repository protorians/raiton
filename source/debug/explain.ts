import type {DebugExplanation, DebugJournalEntry, DebugValidationIssue} from "./types.ts";
import {DEBUG_SCHEMA_VERSION, DebugSchemaVersionError, isSupportedDebugSchemaVersion} from "./types.ts";

function issueHint(issues: DebugValidationIssue[]): string {
    if (!issues.length) return "Retry the request after fixing the reported field.";
    const first = issues[0];
    const field = first.path && first.path !== "/" ? first.path : "the payload";
    const expected = first.expected ? ` Expected ${first.expected}.` : "";
    const received = first.received !== undefined ? ` Received ${first.received}.` : "";
    return `Fix ${field}.${expected}${received} The handler was not executed.`;
}

function rootCause(entry: DebugJournalEntry): {code: string; message: string; hint: string} {
    const validation = entry.validation;
    if (validation && validation.ok === false) {
        const issues = validation.issues ?? [];
        const first = issues[0];
        return {
            code: entry.error?.code ?? "VALIDATION_ERROR",
            message: first
                ? `${first.path || "payload"}: ${first.message}`
                : "The request does not match its input contract.",
            hint: issueHint(issues),
        };
    }

    const code = entry.error?.code;
    const message = entry.error?.message;

    if (code === "OUTPUT_VALIDATION_ERROR") {
        return {
            code,
            message: message ?? "The response does not match its output contract.",
            hint: "The handler ran. Fix the response shape or relax the @Output contract.",
        };
    }
    if (code === "UNAUTHORIZED" || entry.response.status === 401) {
        return {
            code: code ?? "UNAUTHORIZED",
            message: message ?? "The request is not authenticated.",
            hint: "Provide a valid authorization header; this is not a payload validation failure.",
        };
    }
    if (code === "FORBIDDEN" || entry.response.status === 403) {
        return {
            code: code ?? "FORBIDDEN",
            message: message ?? "The request is not allowed.",
            hint: "Check the scopes or permissions attached to the request.",
        };
    }
    if (entry.response.status === 404) {
        return {
            code: code ?? "NOT_FOUND",
            message: message ?? "The route was not mounted.",
            hint: "Run `raiton routes` or `raiton why <method> <path>` to inspect the registered routes.",
        };
    }
    if (entry.response.status === 405) {
        return {
            code: code ?? "METHOD_NOT_ALLOWED",
            message: message ?? "The path exists but not for this method.",
            hint: "Use one of the methods exposed by the route.",
        };
    }
    if (entry.response.status >= 500 || code === "INTERNAL_SERVER_ERROR") {
        return {
            code: code ?? "INTERNAL_SERVER_ERROR",
            message: message ?? "An unexpected error occurred.",
            hint: entry.error?.location
                ? `Inspect ${entry.error.location}; the handler threw before producing a valid response.`
                : "Run the same request in development to obtain the stack and source location.",
        };
    }
    if (entry.response.status >= 400) {
        return {
            code: code ?? `HTTP_${entry.response.status}`,
            message: message ?? `The request failed with status ${entry.response.status}.`,
            hint: "Inspect the response body and the request fields.",
        };
    }

    return {
        code: code ?? "OK",
        message: message ?? `The request completed with status ${entry.response.status}.`,
        hint: "No error was captured for this request.",
    };
}

function nextActions(entry: DebugJournalEntry): string[] {
    const method = entry.request.method;
    const route = entry.request.pattern || entry.request.route;
    const actions: string[] = [];
    const body = entry.request.body;
    if (entry.validation && entry.validation.ok === false) {
        actions.push(`raiton call ${method} ${route} --example default`);
    } else if (body !== undefined && !("truncated" in (body as any))) {
        actions.push(`raiton call ${method} ${route} --data '${JSON.stringify(body)}'`);
    } else {
        actions.push(`raiton call ${method} ${route} --example default`);
    }
    actions.push(`raiton call --replay ${entry.requestId}${["GET", "HEAD", "OPTIONS"].includes(method) ? "" : " --force"}`);
    if (entry.response.status === 404) actions.push("raiton routes");
    return actions;
}

/**
 * Reconstruct the timeline, root cause and next actions from a journal entry.
 * Pure function: no I/O, no side effect.
 */
export function explainEntry(
    entry: DebugJournalEntry,
    options: {verbose?: boolean} = {},
): DebugExplanation {
    if (!isSupportedDebugSchemaVersion(entry.schemaVersion)) {
        throw new DebugSchemaVersionError(entry.schemaVersion);
    }
    const cause = rootCause(entry);
    const explanation: DebugExplanation = {
        schemaVersion: DEBUG_SCHEMA_VERSION,
        requestId: entry.requestId,
        request: {
            method: entry.request.method,
            route: entry.request.route,
            status: entry.response.status,
            durationMs: entry.response.durationMs,
            startedAt: entry.startedAt,
        },
        ...(entry.source ? {source: entry.source} : {}),
        timeline: entry.timeline ?? [],
        diagnosis: {
            code: cause.code,
            rootCause: cause.message,
            issues: entry.validation?.issues ?? [],
            hint: cause.hint,
            ...(entry.error?.location ? {location: entry.error.location} : {}),
            ...(entry.error?.stack?.length ? {stack: entry.error.stack} : {}),
        },
        nextActions: nextActions(entry),
        ...(entry.stale ? {stale: true} : {}),
    };

    if (options.verbose) {
        explanation.request_verbose = entry.request;
        explanation.response_verbose = entry.response;
    }

    return explanation;
}

export function explainHuman(explanation: DebugExplanation): string {
    const lines: string[] = [];
    lines.push(`${explanation.request.method} ${explanation.request.route} → ${explanation.request.status} (${explanation.request.durationMs}ms)`);
    lines.push(`request_id: ${explanation.requestId}`);
    if (explanation.source) {
        lines.push(`source:     ${explanation.source.file}${explanation.source.line ? `:${explanation.source.line}` : ""} (${explanation.source.controller}.${explanation.source.handler})`);
    }
    if (explanation.stale) lines.push("warning:    entry captured before a hot reload; source locations may be stale");
    lines.push("");
    lines.push(`cause: ${explanation.diagnosis.code} — ${explanation.diagnosis.rootCause}`);
    lines.push(`hint:  ${explanation.diagnosis.hint}`);
    if (explanation.diagnosis.location) lines.push(`site:  ${explanation.diagnosis.location}`);
    if (explanation.diagnosis.stack?.length) {
        lines.push("stack:");
        for (const frame of explanation.diagnosis.stack.slice(0, 8)) lines.push(`  ${frame}`);
    }
    for (const issue of explanation.diagnosis.issues) {
        lines.push(
            `  - ${issue.path} (${issue.code}): ${issue.message}` +
            (issue.expected ? ` expected ${issue.expected}` : "") +
            (issue.received !== undefined ? ` received ${issue.received}` : "") +
            (issue.location ? ` at ${issue.location}` : ""),
        );
    }
    if (explanation.timeline.length) {
        lines.push("");
        lines.push("timeline:");
        for (const step of explanation.timeline) {
            lines.push(`  - ${step.step}: ${step.result ?? "ok"}${step.durationMs !== undefined ? ` (${step.durationMs}ms)` : ""}${step.detail ? ` — ${step.detail}` : ""}`);
        }
    }
    if (explanation.nextActions.length) {
        lines.push("");
        lines.push("next:");
        for (const action of explanation.nextActions) lines.push(`  ${action}`);
    }
    return lines.join("\n");
}
