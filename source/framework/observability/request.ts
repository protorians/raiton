let counter = 0;
const VALID_REQUEST_ID = /^[A-Za-z0-9._:+\/-]{1,128}$/;

export function generateRequestId(): string {
    counter = (counter + 1) % Number.MAX_SAFE_INTEGER;
    return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readHeader(headers: any, name: string): string | undefined {
    if (!headers) return undefined;
    if (typeof headers.get === "function") {
        return headers.get(name) ?? undefined;
    }
    const lower = name.toLowerCase();
    if (typeof headers === "object") {
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === lower && value !== undefined) return String(value);
        }
    }
    return undefined;
}

/**
 * Reuse a valid incoming request id, otherwise generate one. Invalid values are
 * rejected rather than reflected, to avoid log injection.
 */
export function resolveRequestId(req: any, header = "x-request-id"): string {
    const incoming = readHeader(req?.headers, header);
    if (incoming && VALID_REQUEST_ID.test(incoming)) return incoming;
    return generateRequestId();
}
