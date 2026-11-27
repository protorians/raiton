let ready = true;
let reason: string | undefined;

export class Readiness {
    static markReady(): void {
        ready = true;
        reason = undefined;
    }

    static markNotReady(nextReason = "shutting down"): void {
        ready = false;
        reason = nextReason;
    }

    static get isReady(): boolean {
        return ready;
    }

    static snapshot(): {ready: boolean; reason?: string} {
        return {ready, reason};
    }
}
