import type {DebugJournalEntry, DebugJournalFilter} from "./types.ts";

export function estimateEntryBytes(entry: DebugJournalEntry): number {
    let bytes = 220;
    const add = (value: any, depth = 0) => {
        if (value === undefined || value === null) return;
        if (typeof value === "string") {
            bytes += value.length;
            return;
        }
        if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
            bytes += 8;
            return;
        }
        if (typeof value !== "object" || depth > 6) {
            bytes += 12;
            return;
        }
        if (Array.isArray(value)) {
            bytes += 12;
            for (const item of value.slice(0, 64)) add(item, depth + 1);
            return;
        }
        for (const [key, child] of Object.entries(value)) {
            bytes += key.length + 2;
            add(child, depth + 1);
        }
    };

    add(entry.request.query);
    add(entry.request.headers);
    add(entry.request.body);
    add(entry.response.body);
    add(entry.validation?.issues);
    return bytes;
}

export interface DebugJournalOptions {
    capacity?: number;
    ttlMs?: number;
    maxTotalBytes?: number;
    now?: () => number;
}

/**
 * Bounded in-memory request journal.
 *
 * - O(1) lookup by `requestId` through a Map.
 * - The ring buffer evicts the oldest entry first; the memory footprint never
 *   grows with the total number of processed requests.
 * - Entries are stored as references/scalars: serialization is deferred to the
 *   reader (`requests`, `explain`, HTTP and MCP tools).
 */
export class DebugJournal {
    readonly capacity: number;
    readonly ttlMs: number;
    readonly maxTotalBytes: number;

    private readonly now: () => number;
    private readonly ring: Array<DebugJournalEntry | undefined>;
    private readonly sizeRing: number[];
    private readonly index = new Map<string, DebugJournalEntry>();
    private head = 0;
    private count = 0;
    private bytes = 0;
    private dropped = 0;
    private nextPurge = 0;
    private buildId: string | null = null;

    constructor(options: DebugJournalOptions = {}) {
        this.capacity = Math.max(1, Math.floor(options.capacity ?? 1_000));
        this.ttlMs = Math.max(0, Math.floor(options.ttlMs ?? 900_000));
        this.maxTotalBytes = Math.max(1_024, Math.floor(options.maxTotalBytes ?? 8 * 1024 * 1024));
        this.now = options.now ?? (() => Date.now());
        this.ring = new Array<DebugJournalEntry | undefined>(this.capacity);
        this.sizeRing = new Array<number>(this.capacity).fill(0);
    }

    get size(): number {
        return this.count;
    }

    get totalBytes(): number {
        return this.bytes;
    }

    get evicted(): number {
        return this.dropped;
    }

    /** Mark every retained entry from another build as stale (HMR). */
    setBuildId(buildId: string): void {
        this.buildId = buildId;
        for (const entry of this.index.values()) {
            if (entry.release.buildId !== buildId) entry.stale = true;
        }
    }

    push(entry: DebugJournalEntry, estimatedBytes?: number): void {
        if (!entry || typeof entry.requestId !== "string") return;
        this.purgeExpired();

        if (this.index.has(entry.requestId)) this.remove(entry.requestId);

        if (this.buildId && entry.release?.buildId !== this.buildId) entry.stale = true;

        if (this.count === this.capacity) this.evictOldest();

        const size = estimatedBytes ?? estimateEntryBytes(entry);
        this.ring[this.head] = entry;
        this.sizeRing[this.head] = size;
        this.head = (this.head + 1) % this.capacity;
        this.count += 1;
        this.bytes += size;
        this.index.set(entry.requestId, entry);

        // A single unusually large entry must not push the journal above its
        // hard budget: evict oldest entries until it fits (the newest entry is
        // always retained).
        while (this.bytes > this.maxTotalBytes && this.count > 1) {
            this.evictOldest();
        }
    }

    get(requestId: string): DebugJournalEntry | undefined {
        return this.index.get(requestId);
    }

    last(): DebugJournalEntry | undefined {
        return this.newest(0);
    }

    recent(filter: DebugJournalFilter = {}): DebugJournalEntry[] {
        this.purgeExpired(true);
        const limit = Math.max(0, Math.floor(filter.limit ?? 20));
        if (limit === 0) return [];

        const since = filter.sinceMs ? this.now() - filter.sinceMs : undefined;
        const output: DebugJournalEntry[] = [];

        for (let offset = 0; offset < this.count; offset++) {
            const entry = this.newest(offset);
            if (!entry) continue;
            if (since !== undefined && Date.parse(entry.startedAt) < since) continue;
            if (filter.status && !matchStatus(entry.response.status, filter.status)) continue;
            if (filter.route) {
                const needle = filter.route.toLowerCase();
                const haystack = `${entry.request.route} ${entry.request.pattern} ${entry.request.path}`.toLowerCase();
                if (!haystack.includes(needle)) continue;
            }
            output.push(entry);
            if (output.length >= limit) break;
        }

        return output;
    }

    clear(): void {
        this.ring.fill(undefined);
        this.sizeRing.fill(0);
        this.index.clear();
        this.head = 0;
        this.count = 0;
        this.bytes = 0;
        this.dropped = 0;
    }

    private newest(offset: number): DebugJournalEntry | undefined {
        if (offset < 0 || offset >= this.count) return undefined;
        const index = (this.head - 1 - offset + this.capacity * 2) % this.capacity;
        return this.ring[index];
    }

    private evictOldest(): void {
        if (this.count === 0) return;
        const oldestIndex = (this.head - this.count + this.capacity * 2) % this.capacity;
        const entry = this.ring[oldestIndex];
        if (!entry) return;
        const size = this.sizeRing[oldestIndex] ?? 0;
        this.ring[oldestIndex] = undefined;
        this.sizeRing[oldestIndex] = 0;
        this.index.delete(entry.requestId);
        this.bytes = Math.max(0, this.bytes - size);
        this.count -= 1;
        this.dropped += 1;
    }

    private remove(requestId: string): void {
        const entry = this.index.get(requestId);
        if (!entry) return;
        this.index.delete(requestId);
        // Keeping a tombstone would corrupt ordering, so rebuild the ring
        // without that entry. Replacement is rare (duplicate request ids).
        const retained: DebugJournalEntry[] = [];
        for (let offset = 0; offset < this.count; offset++) {
            const candidate = this.newest(offset);
            if (candidate && candidate.requestId !== requestId) retained.push(candidate);
        }
        this.rebuild(retained.reverse());
    }

    private purgeExpired(force = false): void {
        if (!this.ttlMs) return;
        const now = this.now();
        // TTL precision of one second is enough and keeps the hot path free of
        // repeated Date.parse calls.
        if (!force && now < this.nextPurge) return;
        this.nextPurge = now + 1_000;
        const threshold = now - this.ttlMs;
        let expired = 0;
        for (let offset = this.count - 1; offset >= 0; offset--) {
            const entry = this.newest(offset);
            if (entry && Date.parse(entry.startedAt) < threshold) expired += 1;
            else break;
        }
        for (let index = 0; index < expired; index++) this.evictOldest();
    }

    private rebuild(entries: DebugJournalEntry[]): void {
        const bounded = entries.slice(-this.capacity);
        this.ring.fill(undefined);
        this.sizeRing.fill(0);
        this.index.clear();
        this.head = 0;
        this.count = 0;
        this.bytes = 0;
        for (const entry of bounded) {
            const size = estimateEntryBytes(entry);
            this.ring[this.head] = entry;
            this.sizeRing[this.head] = size;
            this.head = (this.head + 1) % this.capacity;
            this.count += 1;
            this.bytes += size;
            this.index.set(entry.requestId, entry);
        }
    }
}

export function matchStatus(status: number, filter: string): boolean {
    const value = String(filter).trim().toLowerCase();
    if (!value) return true;
    if (/^\dxx$/.test(value)) return Math.floor(status / 100) === Number(value[0]);
    if (value.includes("-")) {
        const [min, max] = value.split("-").map(part => Number(part));
        return status >= min && status <= max;
    }
    if (value.includes(",")) return value.split(",").some(part => matchStatus(status, part));
    return status === Number(value);
}
