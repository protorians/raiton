import type {ContractIssue} from "./schema.ts";
import {isSensitiveKey, redactionKeys} from "../debug/redaction.ts";

export const DOCS_BASE_URL = "https://github.com/protorians/raiton/blob/main/docs";

export function docsUrl(path = "user-guide/README.md"): string {
    return `${DOCS_BASE_URL}/${path.replace(/^\//, "")}`;
}

export interface ErrorRenderOptions {
    requestId?: string;
    hint?: string;
    /** Development-only contract location. */
    location?: string;
    /** Development-only stack lines. */
    stack?: string[];
    redact?: string[];
    /**
     * When explicitly false, expected/received/location details are omitted:
     * production error bodies never expose internal contract details.
     */
    development?: boolean;
}

export const ERROR_SCHEMA_VERSION = "1.0.0";

export interface ValidationErrorBody {
    error: true;
    schemaVersion: string;
    code: "VALIDATION_ERROR";
    message: string;
    statusCode: number;
    details: ContractIssue[];
    docsUrl: string;
    requestId?: string;
    hint?: string;
}

const SENSITIVE_SEGMENTS = new Set([
    "authorization", "cookie", "password", "secret", "token", "access-token",
    "access_token", "refresh-token", "refresh_token", "api-key", "apikey",
    "x-api-key", "x-raiton-debug-token",
]);

/**
 * Mask sensitive received values and attach the contract source location. The
 * rendered error never contains a raw secret, in development or production.
 */
export function sanitizeIssues(issues: ContractIssue[], options: ErrorRenderOptions = {}): ContractIssue[] {
    const keys = redactionKeys(options.redact ?? []);
    const exposeDetails = options.development !== false;
    return (issues ?? []).map(issue => {
        const segment = String(issue.path ?? "").split(/[./[\]]/).filter(Boolean).pop()?.toLowerCase() ?? "";
        const sensitive = SENSITIVE_SEGMENTS.has(segment) || (segment ? isSensitiveKey(segment, keys) : false);
        return {
            path: issue.path,
            code: issue.code,
            message: issue.message,
            ...(exposeDetails && issue.expected !== undefined ? {expected: issue.expected} : {}),
            ...(exposeDetails && issue.received !== undefined ? {received: sensitive ? "***" : issue.received} : {}),
            ...(exposeDetails && (issue.location ?? options.location)
                ? {location: issue.location ?? options.location}
                : {}),
        };
    });
}

/**
 * Stable validation error payload shared by runtime validation and generated
 * clients. Never includes a stack trace or internal field.
 */
export function validationErrorBody(
    issues: ContractIssue[],
    message = "Invalid request",
    options: ErrorRenderOptions = {},
): ValidationErrorBody {
    return {
        error: true,
        schemaVersion: ERROR_SCHEMA_VERSION,
        code: "VALIDATION_ERROR",
        message,
        statusCode: 400,
        details: sanitizeIssues(issues, options),
        docsUrl: docsUrl("user-guide/recipes/contracts.md"),
        ...(options.requestId ? {requestId: options.requestId} : {}),
        hint: options.hint ?? "Fix the listed fields and retry; the handler was not executed.",
    };
}

/**
 * Thrown before the route handler executes when the input contract fails.
 */
export class ContractValidationError extends Error {
    public readonly statusCode = 400;

    constructor(public readonly issues: ContractIssue[], message = "Invalid request") {
        super(message);
        this.name = "ContractValidationError";
    }

    render(options: ErrorRenderOptions = {}) {
        return validationErrorBody(this.issues, this.message, options);
    }
}

/**
 * Thrown in development when a response does not match its `@Output` contract.
 */
export class OutputContractError extends Error {
    public readonly statusCode = 500;

    constructor(
        public readonly route: string,
        public readonly issues: ContractIssue[],
    ) {
        super(`Response contract violation on ${route}`);
        this.name = "OutputContractError";
    }

    render(options: ErrorRenderOptions = {}) {
        const details = sanitizeIssues(this.issues, options);
        return {
            error: true,
            schemaVersion: ERROR_SCHEMA_VERSION,
            code: "OUTPUT_VALIDATION_ERROR",
            statusCode: 500,
            message: `Response contract violation on ${this.route}`,
            details,
            docsUrl: docsUrl("user-guide/recipes/contracts.md"),
            ...(options.requestId ? {requestId: options.requestId} : {}),
            hint: options.hint
                ?? `The handler ran but its response does not match the @Output contract of ${this.route}.`,
        };
    }
}
