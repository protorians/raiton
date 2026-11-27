import fs from "node:fs";
import path from "node:path";
import {DebugJournal} from "./journal.ts";
import {sessionJournalFile} from "./runtime.ts";
import type {DebugJournalEntry} from "./types.ts";
import {DEBUG_SCHEMA_VERSION, DebugSchemaVersionError, isSupportedDebugSchemaVersion} from "./types.ts";

const MAX_ENTRIES = 1_000;
const MAX_BYTES = 8 * 1024 * 1024;
const TTL_MS = 900_000;

interface DebugSessionFile {
    schemaVersion: string;
    updatedAt: string;
    entries: DebugJournalEntry[];
}

function empty(): DebugSessionFile {
    return {schemaVersion: DEBUG_SCHEMA_VERSION, updatedAt: new Date().toISOString(), entries: []};
}

/**
 * Read the bounded CLI session journal.
 *
 * The in-memory journal remains the runtime source of truth; this file only
 * bridges two short-lived CLI processes (`raiton call` then `raiton explain`)
 * when no running application is targeted. It is bounded, expires after 15
 * minutes and is never written on a request hot path.
 */
export function readSessionFile(workdir?: string): DebugSessionFile {
    const filename = sessionJournalFile(workdir);
    try {
        if (!fs.existsSync(filename)) return empty();
        const raw = fs.readFileSync(filename, "utf-8");
        if (!raw.trim()) return empty();
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.entries)) return empty();
        if (!isSupportedDebugSchemaVersion(parsed.schemaVersion)) {
            throw new DebugSchemaVersionError(parsed.schemaVersion);
        }
        const threshold = Date.now() - TTL_MS;
        return {
            schemaVersion: typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : DEBUG_SCHEMA_VERSION,
            updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
            entries: parsed.entries
                .filter((entry: DebugJournalEntry) =>
                    entry
                    && typeof entry.requestId === "string"
                    && Date.parse(entry.startedAt) >= threshold)
                .slice(-MAX_ENTRIES),
        };
    } catch (error) {
        if (error instanceof DebugSchemaVersionError) throw error;
        return empty();
    }
}

export function readSessionEntries(workdir?: string): DebugJournalEntry[] {
    return readSessionFile(workdir).entries;
}

export function loadSessionJournal(workdir?: string): DebugJournal {
    const journal = new DebugJournal({capacity: MAX_ENTRIES, ttlMs: TTL_MS, maxTotalBytes: MAX_BYTES});
    for (const entry of readSessionEntries(workdir)) journal.push(entry);
    return journal;
}

export function appendSessionEntry(entry: DebugJournalEntry, workdir?: string): void {
    if (!entry?.requestId) return;
    const file = readSessionFile(workdir);
    const entries = file.entries.filter(candidate => candidate.requestId !== entry.requestId);
    entries.push(entry);
    const bounded = entries.slice(-MAX_ENTRIES);
    const payload: DebugSessionFile = {
        schemaVersion: DEBUG_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        entries: bounded,
    };
    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_BYTES) {
        // Keep the newest entries that fit, without ever failing the command.
        while (payload.entries.length > 1 && JSON.stringify(payload).length > MAX_BYTES) {
            payload.entries.shift();
        }
    }
    writeAtomic(sessionJournalFile(workdir), JSON.stringify(payload));
}

export function clearSessionJournal(workdir?: string): void {
    try {
        const filename = sessionJournalFile(workdir);
        if (fs.existsSync(filename)) fs.rmSync(filename, {force: true});
    } catch {
        // Ignore.
    }
}

function writeAtomic(filename: string, content: string): void {
    try {
        fs.mkdirSync(path.dirname(filename), {recursive: true});
        const temporary = `${filename}.${process.pid}.tmp`;
        fs.writeFileSync(temporary, content, "utf-8");
        fs.renameSync(temporary, filename);
    } catch {
        // CLI diagnostics must not fail because the session file is read-only.
    }
}
