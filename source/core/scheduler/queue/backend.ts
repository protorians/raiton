import type {QueueBackendInterface, QueueDequeueOptionsInterface, QueueMessageInterface} from "../../../types/index.ts";

export abstract class BaseQueueBackend implements QueueBackendInterface {
    abstract readonly name: string;
    protected connected = false;

    get isConnected(): boolean {
        return this.connected;
    }

    abstract connect(): Promise<void>;

    abstract disconnect(): Promise<void>;

    abstract enqueue(queue: string, message: QueueMessageInterface): Promise<string>;

    abstract dequeue(queue: string, options?: QueueDequeueOptionsInterface): Promise<QueueMessageInterface[]>;

    abstract acknowledge(queue: string, receipt: any): Promise<void>;

    abstract reject(queue: string, receipt: any, requeue?: boolean): Promise<void>;

    abstract length(queue: string): Promise<number>;

    abstract purge(queue: string): Promise<void>;
}

export function wait(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

interface MemoryEntry {
    message: QueueMessageInterface;
    receipt: MemoryReceipt;
    availableAt: number;
    locked: boolean;
}

interface MemoryReceipt {
    queue: string;
    id: string;
}

/**
 * In-process queue backend used by default when no external broker is
 * configured. Supports blocking dequeue, visibility timeout and ack/nack.
 */
export class MemoryQueueBackend extends BaseQueueBackend {
    readonly name = 'memory';
    private readonly queues = new Map<string, MemoryEntry[]>();
    private readonly visibilityMs: number;

    constructor(options: {visibilityMs?: number} = {}) {
        super();
        this.visibilityMs = options.visibilityMs ?? 30_000;
    }

    async connect(): Promise<void> {
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        this.connected = false;
    }

    async enqueue(queue: string, message: QueueMessageInterface): Promise<string> {
        const entry: MemoryEntry = {
            message,
            receipt: {queue, id: message.id},
            availableAt: message.availableAt ?? Date.now(),
            locked: false,
        };
        this.list(queue).push(entry);
        return message.id;
    }

    async dequeue(queue: string, options: QueueDequeueOptionsInterface = {}): Promise<QueueMessageInterface[]> {
        const blockMs = options.blockMs ?? 0;
        const count = options.count ?? 1;
        const deadline = Date.now() + blockMs;

        while (true) {
            const messages = this.tryDequeue(queue, count);
            if (messages.length > 0) return messages;
            if (Date.now() >= deadline) return [];
            await wait(Math.min(25, Math.max(0, deadline - Date.now())));
        }
    }

    async acknowledge(_queue: string, receipt: MemoryReceipt): Promise<void> {
        const list = this.list(receipt.queue);
        const index = list.findIndex(e => e.receipt.id === receipt.id);
        if (index !== -1) list.splice(index, 1);
    }

    async reject(queue: string, receipt: MemoryReceipt, requeue = true): Promise<void> {
        const list = this.list(queue);
        const index = list.findIndex(e => e.receipt.id === receipt.id);
        if (index === -1) return;
        const entry = list[index];
        if (requeue) {
            entry.locked = false;
            entry.availableAt = Date.now();
            entry.message.attempts += 1;
        } else {
            list.splice(index, 1);
        }
    }

    async length(queue: string): Promise<number> {
        return this.list(queue).length;
    }

    async purge(queue: string): Promise<void> {
        this.list(queue).length = 0;
    }

    private list(queue: string): MemoryEntry[] {
        let list = this.queues.get(queue);
        if (!list) {
            list = [];
            this.queues.set(queue, list);
        }
        return list;
    }

    private tryDequeue(queue: string, count: number): QueueMessageInterface[] {
        const now = Date.now();
        const list = this.list(queue);
        const result: QueueMessageInterface[] = [];

        for (const entry of list) {
            if (result.length >= count) break;
            if (entry.locked || entry.availableAt > now) continue;
            entry.locked = true;
            entry.availableAt = now + this.visibilityMs;
            result.push({...entry.message, receipt: entry.receipt});
        }

        return result;
    }
}
