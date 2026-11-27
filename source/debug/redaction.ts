/**
 * Secret redaction and bounded capture helpers.
 *
 * These helpers are dependency-free and safe to import from the error
 * catalogue, the request journal and the CLI: they never throw on circular
 * structures and never mutate their input.
 */

export const REDACTED = "***";

/** Header and body keys masked by default. Extend with `debug.journal.redact`. */
export const DEFAULT_REDACT_KEYS: readonly string[] = [
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "api-key",
    "apikey",
    "x-raiton-debug-token",
    "x-auth-token",
    "proxy-authorization",
    "password",
    "passwd",
    "secret",
    "client-secret",
    "client_secret",
    "token",
    "access-token",
    "access_token",
    "refresh-token",
    "refresh_token",
    "id-token",
    "id_token",
    "private-key",
    "private_key",
    "credit-card",
    "card-number",
    "cvv",
    "ssn",
];

export interface RedactOptions {
    keys?: readonly string[];
    /** Maximum depth explored. @default 8 */
    depth?: number;
    /** Maximum items per array. @default 100 */
    maxItems?: number;
}

function normalizeKey(key: string): string {
    return key.toLowerCase().replace(/[\s_]+/g, "-");
}

/**
 * Build a case-insensitive, normalised set from the built-in list and any
 * project-specific keys.
 */
export function redactionKeys(extra: readonly string[] = []): Set<string> {
    const keys = new Set<string>();
    for (const key of [...DEFAULT_REDACT_KEYS, ...extra]) {
        if (typeof key === "string" && key.trim()) keys.add(normalizeKey(key));
    }
    return keys;
}

export function isSensitiveKey(key: string, keys: Set<string>): boolean {
    const normalized = normalizeKey(key);
    if (keys.has(normalized)) return true;
    // Match common prefixes/suffixes without over-redacting unrelated fields:
    // `x-api-key`, `user_password`, `refreshToken` all resolve here.
    for (const sensitive of keys) {
        if (normalized.endsWith(`-${sensitive}`) || normalized.startsWith(`${sensitive}-`)) return true;
    }
    return false;
}

/**
 * Deep-clone a value while masking sensitive keys. The returned value is safe
 * to serialize or store in the journal.
 */
export function redactValue<T = any>(value: T, options: RedactOptions = {}): T {
    const keys = redactionKeys(options.keys ?? []);
    const maxDepth = options.depth ?? 8;
    const maxItems = options.maxItems ?? 100;

    const walk = (input: any, depth: number, seen: WeakSet<object>): any => {
        if (input === null || input === undefined) return input;
        if (typeof input === "string") return input;
        if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") return input;
        if (typeof input === "function" || typeof input === "symbol") return undefined;
        if (depth > maxDepth) return "[truncated]";
        if (typeof input !== "object") return input;
        if (seen.has(input as object)) return "[circular]";
        seen.add(input as object);

        if (Array.isArray(input)) {
            return input.slice(0, maxItems).map(item => walk(item, depth + 1, seen));
        }

        if (input instanceof Date) return input.toISOString();
        if (input instanceof Uint8Array) return `[binary ${input.byteLength} bytes]`;

        const output: Record<string, any> = {};
        let index = 0;
        for (const [key, child] of Object.entries(input)) {
            if (index++ >= maxItems) {
                output["..."] = "[truncated]";
                break;
            }
            output[key] = isSensitiveKey(key, keys) ? REDACTED : walk(child, depth + 1, seen);
        }
        return output;
    };

    try {
        return walk(value, 0, new WeakSet()) as T;
    } catch {
        return "[unserializable]" as unknown as T;
    }
}

/**
 * Convert any header container (Headers, Map, plain object) to a redacted
 * plain object.
 */
export function redactHeaders(headers: any, extraKeys: readonly string[] = []): Record<string, string> {
    const keys = redactionKeys(extraKeys);
    const output: Record<string, string> = {};
    if (!headers) return output;

    try {
        const entries: Array<[string, any]> = typeof (headers as any).entries === "function"
            ? [...(headers as any).entries()]
            : Object.entries(headers);
        for (const [key, value] of entries) {
            const name = String(key).toLowerCase();
            output[name] = isSensitiveKey(name, keys) ? REDACTED : String(value);
        }
    } catch {
        // Header containers are runtime-specific; a failure must never break a
        // request or a diagnostic.
    }
    return output;
}

/** Normalise a header container to a plain, lower-cased object. */
export function headersToObject(headers: any): Record<string, string> {
    const output: Record<string, string> = {};
    if (!headers) return output;
    try {
        const entries: Array<[string, any]> = typeof (headers as any).entries === "function"
            ? [...(headers as any).entries()]
            : Object.entries(headers);
        for (const [key, value] of entries) {
            if (value === undefined) continue;
            output[String(key).toLowerCase()] = String(value);
        }
    } catch {
        // Ignore unusable header containers.
    }
    return output;
}

export function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/**
 * Bound a captured body. The value is serialized once; oversized payloads are
 * replaced by an explicit marker and a bounded preview. The request itself is
 * never affected.
 */
export function truncateValue(value: any, maxBytes: number): any {
    if (value === undefined) return undefined;
    if (!Number.isFinite(maxBytes) || maxBytes <= 0) return "[capture disabled]";

    try {
        const serialized = JSON.stringify(value);
        if (serialized === undefined) return value;
        const bytes = byteLength(serialized);
        if (bytes <= maxBytes) return value;
        const preview = serialized.slice(0, Math.max(0, maxBytes));
        return {
            truncated: true,
            bytes,
            maxBytes,
            preview,
        };
    } catch {
        return "[unserializable]";
    }
}

export function byteLength(value: string): number {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).byteLength;
    // Fallback for exotic runtimes without TextEncoder.
    let bytes = 0;
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
    }
    return bytes;
}

/**
 * One-line summary of a received value, safely bounded. Sensitive field paths
 * are masked by the caller (see `describeIssue`).
 */
export function summarizeValue(value: any, maxLength = 80): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
    if (Array.isArray(value)) return `array(${value.length})`;
    if (typeof value === "object") {
        const constructor = (value as any)?.constructor?.name;
        if (constructor && constructor !== "Object") return constructor;
        return "object";
    }
    return String(value);
}
