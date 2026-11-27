import {Logger} from "@protorians/logger";
import type {McpAuditEvent} from "../../types/index.ts";

const SENSITIVE = /(authorization|token|secret|password|passphrase|api[-_]?key|credential|cookie)/i;

export function redact(value: any, depth = 0): any {
    if (depth > 6) return "[truncated]";
    if (value === null || value === undefined) return value;
    if (typeof value === "string") return value.length > 512 ? `${value.slice(0, 512)}…` : value;
    if (Array.isArray(value)) return value.map(item => redact(item, depth + 1));
    if (typeof value === "object") {
        const output: Record<string, any> = {};
        for (const [key, child] of Object.entries(value)) {
            output[key] = SENSITIVE.test(key) ? "[redacted]" : redact(child, depth + 1);
        }
        return output;
    }
    return value;
}

/**
 * MCP audit trail. Emits a structured event for every tool call and logs it on
 * stderr through the framework logger. Secrets are always redacted.
 */
export class McpAudit {
    private static listeners = new Set<(event: McpAuditEvent) => void>();

    static on(listener: (event: McpAuditEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    static emit(event: McpAuditEvent): McpAuditEvent {
        const safe: McpAuditEvent = {
            ...event,
            arguments: redact(event.arguments),
            result: redact(event.result),
        };
        for (const listener of this.listeners) {
            try {
                listener(safe);
            } catch {
                // An audit listener must never break a tool call.
            }
        }
        Logger.info(
            `[mcp:audit] ${safe.server}.${safe.tool} call=${safe.callId} ` +
            `actor=${safe.actor ?? "anonymous"} transport=${safe.transport ?? "unknown"} ` +
            `duration=${safe.durationMs}ms success=${safe.success}`
        );
        return safe;
    }

    static clear(): void {
        this.listeners.clear();
    }
}
