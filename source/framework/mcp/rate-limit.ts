interface Bucket {
    count: number;
    resetAt: number;
}

/**
 * Simple per-tool fixed window limiter. Disabled when `limit <= 0`.
 * Opt-in only: no timers, no background work.
 */
export class McpRateLimiter {
    private buckets = new Map<string, Bucket>();

    consume(key: string, limitPerMinute: number): boolean {
        if (!limitPerMinute || limitPerMinute <= 0) return true;
        const now = Date.now();
        let bucket = this.buckets.get(key);

        if (!bucket || bucket.resetAt <= now) {
            bucket = {count: 0, resetAt: now + 60_000};
            this.buckets.set(key, bucket);
        }

        if (bucket.count >= limitPerMinute) return false;
        bucket.count += 1;
        return true;
    }

    reset(): void {
        this.buckets.clear();
    }
}

export const mcpRateLimiter = new McpRateLimiter();
