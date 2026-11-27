import path from "node:path";
import type {ApplicationInterface} from "../types/application.ts";
import type {ProjectManifest} from "../manifest/schema.ts";
import {DebugCollector} from "./collector.ts";
import {DebugJournal} from "./journal.ts";
import type {DebugLogLine, ResolvedDebugConfig} from "./types.ts";

const GLOBAL_KEY = "__raitonDebugRuntime";
const LOG_CAPACITY = 200;

export interface DebugLogBuffer {
    record(level: string, message: string): void;
    tail(limit?: number): DebugLogLine[];
    clear(): void;
}

function maskSecrets(message: string): string {
    return String(message)
        .replace(/(authorization\s*[:=]\s*)([^\s,;]+)/gi, "$1***")
        .replace(/(bearer\s+)([A-Za-z0-9._~+/=-]+)/gi, "$1***")
        .replace(/((?:password|passwd|secret|token|api[-_]?key)\s*[:=]\s*["']?)([^\s"',;]+)/gi, "$1***")
        .slice(0, 512);
}

function createLogBuffer(): DebugLogBuffer {
    const lines: DebugLogLine[] = [];
    return {
        record(level, message) {
            try {
                lines.push({at: new Date().toISOString(), level, message: maskSecrets(String(message))});
                if (lines.length > LOG_CAPACITY) lines.splice(0, lines.length - LOG_CAPACITY);
            } catch {
                // Logging must never fail.
            }
        },
        tail(limit = 50) {
            return lines.slice(Math.max(0, lines.length - Math.max(0, limit)));
        },
        clear() {
            lines.length = 0;
        },
    };
}

export interface DebugRuntimeState {
    config: ResolvedDebugConfig;
    journal?: DebugJournal;
    collector?: DebugCollector;
    buildId: string;
    development: boolean;
    workdir: string;
    application?: ApplicationInterface;
    logs: DebugLogBuffer;
}

export interface ConfigureDebugOptions {
    config: ResolvedDebugConfig;
    development: boolean;
    workdir?: string;
    application?: ApplicationInterface;
    buildId?: string;
}

function newBuildId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Configure the process-wide debug runtime. The journal survives HMR reloads
 * (it lives on `globalThis`) while a new build id marks older entries stale.
 */
export function configureDebug(options: ConfigureDebugOptions): DebugRuntimeState {
    const global = globalThis as any;
    const previous: DebugRuntimeState | undefined = global[GLOBAL_KEY];
    const buildId = options.buildId ?? (previous ? newBuildId() : newBuildId());
    const workdir = options.workdir ?? previous?.workdir ?? process.cwd();

    let journal: DebugJournal | undefined;
    if (options.config.journal.enabled && options.config.journal.capture !== "off") {
        journal = new DebugJournal({
            capacity: options.config.journal.capacity,
            ttlMs: options.config.journal.ttlMs,
            maxTotalBytes: options.config.journal.maxTotalBytes,
        });
        // Preserve entries across HMR by moving them into the new journal.
        if (previous?.journal) {
            const retained = previous.journal.recent({limit: options.config.journal.capacity});
            for (const entry of retained.reverse()) journal.push(entry);
        }
        journal.setBuildId(buildId);
    }

    const collector = journal
        ? new DebugCollector({
            config: options.config,
            journal,
            buildId,
            development: options.development,
        })
        : undefined;

    const state: DebugRuntimeState = {
        config: options.config,
        journal,
        collector,
        buildId,
        development: options.development,
        workdir,
        application: options.application ?? previous?.application,
        logs: previous?.logs ?? createLogBuffer(),
    };

    global[GLOBAL_KEY] = state;
    return state;
}

export function getDebugRuntime(): DebugRuntimeState | undefined {
    return (globalThis as any)[GLOBAL_KEY] as DebugRuntimeState | undefined;
}

export function getDebugCollector(): DebugCollector | undefined {
    return getDebugRuntime()?.collector;
}

export function getDebugJournal(): DebugJournal | undefined {
    return getDebugRuntime()?.journal;
}

export function isDebugJournalEnabled(): boolean {
    const runtime = getDebugRuntime();
    return Boolean(runtime?.config.journal.enabled && runtime.journal);
}

export function resetDebugRuntime(): void {
    delete (globalThis as any)[GLOBAL_KEY];
}

/**
 * Mark every retained entry as stale after a hot reload. The journal survives,
 * but old entries are never mixed with the new build without a marker.
 */
export function rotateDebugBuild(): void {
    const runtime = getDebugRuntime();
    if (!runtime) return;
    const buildId = newBuildId();
    runtime.buildId = buildId;
    if (runtime.collector) runtime.collector.buildId = buildId;
    runtime.journal?.setBuildId(buildId);
}

export function recordDebugLog(level: string, message: string): void {
    getDebugRuntime()?.logs.record(level, message);
}

export interface DebugContextOptions {
    workdir?: string;
    application?: ApplicationInterface;
}

export function setDebugContext(options: DebugContextOptions): void {
    const runtime = getDebugRuntime();
    if (!runtime) return;
    if (options.workdir) runtime.workdir = options.workdir;
    if (options.application) runtime.application = options.application;
}

/** Load the live project manifest, using the existing cache when possible. */
export async function loadDebugManifest(refresh = false): Promise<ProjectManifest> {
    const runtime = getDebugRuntime();
    if (!runtime) {
        throw new Error("Debug runtime is not configured");
    }
    const {generateManifest} = await import("../manifest/manifest.ts");
    return generateManifest({workdir: runtime.workdir, refresh});
}

/** Resolve the session-journal file used to bridge short-lived CLI processes. */
export function sessionJournalFile(workdir?: string): string {
    const root = workdir ?? getDebugRuntime()?.workdir ?? process.cwd();
    return path.join(root, ".raiton", "debug-session.json");
}
