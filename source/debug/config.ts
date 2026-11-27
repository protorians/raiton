import {RaitonConfig} from "../core/config/config.ts";
import type {
    DebugCaptureMode,
    DebugConfigInterface,
    DebugHttpConfigInterface,
    DebugJournalConfigInterface,
    DebugMcpConfigInterface,
} from "../types/config.ts";
import type {ResolvedDebugConfig} from "./types.ts";

const FALSEY = new Set(["0", "false", "off", "no", "disabled"]);
const TRUTHY = new Set(["1", "true", "on", "yes", "enabled"]);

export function envFlag(name: string): boolean | undefined {
    const raw = process.env[name];
    if (raw === undefined) return undefined;
    const value = raw.trim().toLowerCase();
    if (TRUTHY.has(value)) return true;
    if (FALSEY.has(value)) return false;
    return undefined;
}

function positiveInteger(value: unknown, fallback: number): number {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.floor(number) : fallback;
}

function captureMode(value: unknown, development: boolean): DebugCaptureMode {
    if (value === "off" || value === "metadata" || value === "full") return value;
    return development ? "full" : "metadata";
}

function loopbackOnly(value: unknown): boolean {
    return value === undefined ? true : value !== false;
}

export interface ResolveDebugOptions {
    development: boolean;
    /** Project root, used to resolve source locations and session files. */
    workdir?: string;
}

/**
 * Resolve the debug section against defaults and environment variables.
 *
 * Production safety: surfaces stay disabled unless `debug.enabled` (or
 * `RAITON_DEBUG`) is explicitly enabled. Even when enabled, the HTTP surface
 * defaults to a loopback-only binding and an optional token.
 */
export function resolveDebugConfig(options: ResolveDebugOptions): ResolvedDebugConfig {
    const raw = (RaitonConfig.get("debug") ?? {}) as DebugConfigInterface;
    const envAll = envFlag("RAITON_DEBUG");
    const enabled = envAll ?? raw.enabled ?? options.development;

    const journalRaw = (raw.journal ?? {}) as DebugJournalConfigInterface;
    const httpRaw = (raw.http ?? {}) as DebugHttpConfigInterface;
    const mcpRaw = (raw.mcp ?? {}) as DebugMcpConfigInterface;

    const journalEnabled = envFlag("RAITON_DEBUG_JOURNAL") ?? journalRaw.enabled ?? enabled;
    const mcpEnabled = envFlag("RAITON_DEBUG_MCP") ?? mcpRaw.enabled ?? enabled;

    const capacity = Math.max(1, positiveInteger(journalRaw.capacity, 1_000));
    const maxBodyBytes = Math.max(0, positiveInteger(journalRaw.maxBodyBytes, 65_536));
    const ttlMs = Math.max(0, positiveInteger(journalRaw.ttlMs, 900_000));
    const sampleRate = clamp(Number(journalRaw.sampleRate ?? 1), 0, 1);

    const tokenEnv = httpRaw.tokenEnv || "RAITON_DEBUG_TOKEN";
    const token = process.env[tokenEnv] || undefined;

    return {
        enabled: Boolean(enabled),
        development: options.development,
        raw,
        journal: {
            enabled: Boolean(journalEnabled && enabled),
            capacity,
            maxBodyBytes,
            capture: captureMode(journalRaw.capture, options.development),
            ttlMs,
            sampleRate,
            redact: Array.isArray(journalRaw.redact) ? [...journalRaw.redact] : [],
            maxTotalBytes: 8 * 1024 * 1024,
        },
        http: {
            enabled: Boolean(enabled && (httpRaw.enabled ?? true)),
            basePath: normalizeBasePath(httpRaw.basePath || "/__raiton"),
            loopbackOnly: loopbackOnly(httpRaw.loopbackOnly),
            tokenEnv,
            token,
        },
        mcp: {
            enabled: Boolean(enabled && (mcpEnabled ?? true)),
            path: normalizeBasePath(mcpRaw.path || "/__raiton/mcp"),
        },
        replay: {
            allowUnsafeMethods: raw.replay?.allowUnsafeMethods === true,
        },
    };
}

function clamp(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) return max;
    return Math.min(max, Math.max(min, value));
}

function normalizeBasePath(value: string): string {
    let normalized = value.startsWith("/") ? value : `/${value}`;
    normalized = normalized.replace(/\/+/g, "/");
    if (normalized.length > 1) normalized = normalized.replace(/\/+$/, "");
    return normalized || "/";
}

/** Constant-time string comparison for tokens. */
export function safeCompare(left: string, right: string): boolean {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let index = 0; index < left.length; index++) {
        difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
    }
    return difference === 0;
}

/** Read a debug token from either documented header or a Bearer token. */
export function readDebugToken(headers: any): string | undefined {
    if (!headers) return undefined;
    const read = (name: string): string | undefined => {
        if (typeof headers.get === "function") {
            const value = headers.get(name);
            if (value) return String(value);
        }
        const lower = name.toLowerCase();
        for (const [key, value] of Object.entries(headers)) {
            if (key.toLowerCase() === lower && value !== undefined) return String(value);
        }
        return undefined;
    };
    const direct = read("x-raiton-debug-token");
    if (direct) return direct;
    const authorization = read("authorization");
    if (authorization?.toLowerCase().startsWith("bearer ")) return authorization.slice(7).trim();
    return undefined;
}
