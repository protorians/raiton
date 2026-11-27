import {HttpStatus} from "../enums/index.ts";

export interface ErrorCatalogEntry {
    code: string;
    status: HttpStatus;
    message: string;
    docsPath: string;
}

const DOCS_BASE = "https://github.com/protorians/raiton/blob/main/docs";

export function errorDocsUrl(path: string): string {
    return `${DOCS_BASE}/${path.replace(/^\//, "")}`;
}

/**
 * Stable public error catalogue. Codes never change once published; new codes
 * are additive and documented before release.
 */
export const ERROR_CATALOG: Record<string, ErrorCatalogEntry> = {
    BAD_REQUEST: {
        code: "BAD_REQUEST",
        status: HttpStatus.BAD_REQUEST,
        message: "Bad request",
        docsPath: "user-guide/responses.md",
    },
    VALIDATION_ERROR: {
        code: "VALIDATION_ERROR",
        status: HttpStatus.BAD_REQUEST,
        message: "Invalid request",
        docsPath: "user-guide/recipes/contracts.md",
    },
    OUTPUT_VALIDATION_ERROR: {
        code: "OUTPUT_VALIDATION_ERROR",
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Response does not match its contract",
        docsPath: "user-guide/recipes/contracts.md",
    },
    UNAUTHORIZED: {
        code: "UNAUTHORIZED",
        status: HttpStatus.UNAUTHORIZED,
        message: "Unauthorized",
        docsPath: "user-guide/security.md",
    },
    FORBIDDEN: {
        code: "FORBIDDEN",
        status: HttpStatus.FORBIDDEN,
        message: "Forbidden",
        docsPath: "user-guide/security.md",
    },
    NOT_FOUND: {
        code: "NOT_FOUND",
        status: HttpStatus.NOT_FOUND,
        message: "Not found",
        docsPath: "user-guide/api/routes.md",
    },
    METHOD_NOT_ALLOWED: {
        code: "METHOD_NOT_ALLOWED",
        status: HttpStatus.METHOD_NOT_ALLOWED,
        message: "Method not allowed",
        docsPath: "user-guide/api/routes.md",
    },
    CONFLICT: {
        code: "CONFLICT",
        status: HttpStatus.CONFLICT,
        message: "Conflict",
        docsPath: "user-guide/responses.md",
    },
    RATE_LIMITED: {
        code: "RATE_LIMITED",
        status: HttpStatus.TOO_MANY_REQUESTS,
        message: "Too many requests",
        docsPath: "user-guide/security.md",
    },
    INTERNAL_SERVER_ERROR: {
        code: "INTERNAL_SERVER_ERROR",
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal server error",
        docsPath: "user-guide/responses.md",
    },
    SERVICE_UNAVAILABLE: {
        code: "SERVICE_UNAVAILABLE",
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: "Service unavailable",
        docsPath: "user-guide/health-check.md",
    },
    CONFIGURATION_ERROR: {
        code: "CONFIGURATION_ERROR",
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: "Invalid application configuration",
        docsPath: "user-guide/config.md",
    },
};

export interface ErrorPayloadOptions {
    message?: string;
    details?: any;
    requestId?: string;
    statusCode?: number;
    docsUrl?: string;
    data?: any;
}

/**
 * Build a stable error body. In production it never contains a stack trace or
 * internal detail beyond the catalogue entry and validated public fields.
 */
export function errorPayload(code: string, options: ErrorPayloadOptions = {}) {
    const entry = ERROR_CATALOG[code] ?? ERROR_CATALOG.INTERNAL_SERVER_ERROR;
    return {
        error: true,
        code: entry.code,
        statusCode: options.statusCode ?? entry.status,
        message: options.message ?? entry.message,
        docsUrl: options.docsUrl ?? errorDocsUrl(entry.docsPath),
        ...(options.requestId ? {requestId: options.requestId} : {}),
        ...(options.details !== undefined ? {details: options.details} : {}),
        ...(options.data !== undefined ? {data: options.data} : {}),
    };
}

export function catalogEntry(code: string): ErrorCatalogEntry {
    return ERROR_CATALOG[code] ?? ERROR_CATALOG.INTERNAL_SERVER_ERROR;
}

const STATUS_TO_CODE: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    429: "RATE_LIMITED",
    500: "INTERNAL_SERVER_ERROR",
    503: "SERVICE_UNAVAILABLE",
};

export function codeForStatus(status: number): string {
    return STATUS_TO_CODE[status] ?? "INTERNAL_SERVER_ERROR";
}

/**
 * Enrich a legacy exception payload with the stable catalogue fields without
 * removing existing fields (backward-compatible additive change).
 */
export function enrichErrorPayload(payload: any, statusCode?: number, requestId?: string) {
    const code = payload?.code
        ?? (typeof payload?.errorCode === "string" ? payload.errorCode : undefined)
        ?? codeForStatus(statusCode ?? payload?.statusCode ?? 500);
    const known = ERROR_CATALOG[code];
    const fallback = catalogEntry(codeForStatus(statusCode ?? payload?.statusCode ?? 500));
    return {
        ...payload,
        code: known?.code ?? code,
        statusCode: payload?.statusCode ?? statusCode ?? known?.status ?? fallback.status,
        docsUrl: payload?.docsUrl ?? errorDocsUrl(known?.docsPath ?? fallback.docsPath),
        ...(requestId ? {requestId} : {}),
    };
}
