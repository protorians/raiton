import {Readiness} from "./readiness.ts";

/**
 * Tracks in-flight requests and drains them with a configurable upper bound.
 * Readiness flips to `false` as soon as shutdown starts.
 */
export class ShutdownManager {
    private inFlight = 0;
    private waiters: Array<() => void> = [];
    private draining = false;
    private completedDrains = 0;

    get activeRequests(): number {
        return this.inFlight;
    }

    get isDraining(): boolean {
        return this.draining;
    }

    get drains(): number {
        return this.completedDrains;
    }

    track(): () => void {
        this.inFlight += 1;
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.inFlight = Math.max(0, this.inFlight - 1);
            if (this.inFlight === 0) this.flush();
        };
    }

    private flush(): void {
        const waiters = this.waiters;
        this.waiters = [];
        for (const resolve of waiters) resolve();
    }

    async drain(timeoutMs = 10_000): Promise<{drained: boolean; remaining: number}> {
        this.draining = true;
        Readiness.markNotReady("shutting down");

        if (this.inFlight === 0) {
            this.completedDrains += 1;
            return {drained: true, remaining: 0};
        }

        await Promise.race([
            new Promise<void>(resolve => this.waiters.push(resolve)),
            new Promise<void>(resolve => setTimeout(resolve, Math.max(0, timeoutMs))),
        ]);

        this.completedDrains += 1;
        return {drained: this.inFlight === 0, remaining: this.inFlight};
    }

    reset(): void {
        this.inFlight = 0;
        this.waiters = [];
        this.draining = false;
        Readiness.markReady();
    }
}

export const shutdown = new ShutdownManager();
