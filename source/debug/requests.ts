import {getDebugJournal, getDebugRuntime} from "./runtime.ts";
import {loadSessionJournal, readSessionEntries} from "./session.ts";
import {matchStatus} from "./journal.ts";
import type {DebugJournalEntry, DebugRequestsList} from "./types.ts";
import {DEBUG_SCHEMA_VERSION} from "./types.ts";

export interface ListRequestsOptions {
    since?: string | number;
    status?: string;
    route?: string;
    limit?: number;
    includeBodies?: boolean;
    workdir?: string;
}

/** Parse `5m`, `30s`, `2h`, `1000ms` or a number of milliseconds. */
export function parseSince(value?: string | number): number | undefined {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
    const text = String(value).trim().toLowerCase();
    const match = text.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/);
    if (!match) return undefined;
    const amount = Number(match[1]);
    const unit = match[2] ?? "ms";
    const factor = unit === "ms" ? 1 : unit === "s" ? 1_000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
    return amount * factor;
}

export interface RequestLookup {
    entry: DebugJournalEntry;
    origin: "journal" | "session";
}

/**
 * Find a request by id in the in-memory journal, then in the bounded CLI
 * session file. Returns `undefined` when neither contains it.
 */
export function findRequest(requestId: string, workdir?: string): RequestLookup | undefined {
    const journal = getDebugJournal();
    const entry = journal?.get(requestId);
    if (entry) return {entry, origin: "journal"};

    for (const candidate of readSessionEntries(workdir ?? getDebugRuntime()?.workdir)) {
        if (candidate.requestId === requestId) return {entry: candidate, origin: "session"};
    }
    return undefined;
}

export function lastRequest(workdir?: string): RequestLookup | undefined {
    const journal = getDebugJournal();
    const inMemory = journal?.last();
    if (inMemory) return {entry: inMemory, origin: "journal"};

    const entries = readSessionEntries(workdir ?? getDebugRuntime()?.workdir);
    const last = entries[entries.length - 1];
    return last ? {entry: last, origin: "session"} : undefined;
}

function summary(entry: DebugJournalEntry) {
    return {
        requestId: entry.requestId,
        traceId: entry.traceId,
        startedAt: entry.startedAt,
        method: entry.request.method,
        route: entry.request.route,
        status: entry.response.status,
        durationMs: entry.response.durationMs,
        ...(entry.stale ? {stale: true} : {}),
    };
}

/**
 * List retained requests, most recent first. Bodies are omitted by default so
 * the output stays token-efficient.
 */
export function listRequests(options: ListRequestsOptions = {}): DebugRequestsList {
    const runtime = getDebugRuntime();
    const journal = getDebugJournal();
    const session = !journal
        ? loadSessionJournal(options.workdir ?? runtime?.workdir)
        : undefined;
    const source = journal ?? session;

    const limit = Math.max(0, Math.floor(Number.isFinite(Number(options.limit)) ? Number(options.limit) : 20));
    const sinceMs = parseSince(options.since);

    const entries = source?.recent({
        sinceMs,
        status: options.status,
        route: options.route,
        limit,
    }) ?? [];

    return {
        schemaVersion: DEBUG_SCHEMA_VERSION,
        count: entries.length,
        capacity: source?.capacity ?? runtime?.config.journal.capacity ?? 1_000,
        enabled: Boolean(journal || session),
        requests: entries.map(summary),
    };
}

/** Used by the HTTP surface when `includeBodies` is requested. */
export function listRequestsWithBodies(options: ListRequestsOptions = {}): DebugRequestsList & {entries: DebugJournalEntry[]} {
    const runtime = getDebugRuntime();
    const journal = getDebugJournal();
    const session = !journal ? loadSessionJournal(options.workdir ?? runtime?.workdir) : undefined;
    const source = journal ?? session;
    const limit = Math.max(0, Math.floor(Number.isFinite(Number(options.limit)) ? Number(options.limit) : 20));
    const entries = source?.recent({
        sinceMs: parseSince(options.since),
        status: options.status,
        route: options.route,
        limit,
    }) ?? [];
    return {
        schemaVersion: DEBUG_SCHEMA_VERSION,
        count: entries.length,
        capacity: source?.capacity ?? 1_000,
        enabled: Boolean(journal || session),
        requests: entries.map(summary),
        entries,
    };
}

export {matchStatus};

/**
 * Resolve the invocation path for a captured entry. Metadata capture omits
 * params, so the concrete path is the only replayable form in that mode.
 */
export function replayPath(entry: DebugJournalEntry): string {
    const hasParams = entry.request.params && Object.keys(entry.request.params).length > 0;
    if (hasParams) return entry.request.pattern || entry.request.route;
    return entry.request.path || entry.request.pattern || entry.request.route;
}
