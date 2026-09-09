import {BaseQueueBackend, wait} from "./backend.ts";
import type {QueueDequeueOptionsInterface, QueueMessageInterface} from "../../../types/index.ts";

export interface RedisQueueBackendOptions {
    url?: string;
    client?: any;
    prefix?: string;
    [key: string]: any;
}

/**
 * Redis-backed queue using a reliable list pattern (enqueue with `RPUSH`,
 * dequeue atomically with `LMOVE` to a processing list, ack with `LREM`).
 *
 * The `redis` package is imported lazily so the framework never requires it
 * unless this backend is actually used:
 *
 * ```ts
 * import {SchedulerManager, RedisQueueBackend} from 'raiton/core';
 * SchedulerManager.current.registerBackend('default', new RedisQueueBackend({url: 'redis://localhost:6379'}))
 * ```
 */
export class RedisQueueBackend extends BaseQueueBackend {
    readonly name = 'redis';
    private client: any;
    private readonly options: RedisQueueBackendOptions;
    private readonly prefix: string;

    constructor(options: RedisQueueBackendOptions = {}) {
        super();
        this.options = options;
        this.prefix = options.prefix ?? 'raiton:queue:';
    }

    async connect(): Promise<void> {
        if (this.connected) return;
        if (this.options.client) {
            this.client = this.options.client;
        } else {
            const redis = await importRedis();
            this.client = redis.createClient({url: this.options.url, ...this.options});
            this.client.on?.('error', (err: any) => {
                // Keep the process alive on transient redis errors.
            });
        }
        if (typeof this.client.connect === 'function' && !this.client.isOpen) {
            await this.client.connect();
        }
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        if (!this.connected) return;
        if (typeof this.client.disconnect === 'function') {
            await this.client.disconnect();
        } else if (typeof this.client.quit === 'function') {
            await this.client.quit();
        }
        this.connected = false;
    }

    async enqueue(queue: string, message: QueueMessageInterface): Promise<string> {
        await this.ensureConnected();
        const raw = JSON.stringify(message);
        await this.client.rPush(this.key(queue), raw);
        return message.id;
    }

    async dequeue(queue: string, options: QueueDequeueOptionsInterface = {}): Promise<QueueMessageInterface[]> {
        await this.ensureConnected();
        const blockMs = options.blockMs ?? 0;
        const count = options.count ?? 1;
        const deadline = Date.now() + blockMs;
        const results: QueueMessageInterface[] = [];

        while (results.length < count) {
            const raw = await this.client.lMove(
                this.key(queue),
                this.processingKey(queue),
                'RIGHT',
                'LEFT',
            );

            if (raw !== null && raw !== undefined) {
                const message = JSON.parse(raw) as QueueMessageInterface;
                message.receipt = raw;
                results.push(message);
                continue;
            }

            if (Date.now() >= deadline) break;
            await wait(Math.min(25, Math.max(0, deadline - Date.now())));
        }

        return results;
    }

    async acknowledge(queue: string, receipt: any): Promise<void> {
        await this.ensureConnected();
        await this.client.lRem(this.processingKey(queue), 1, receipt);
    }

    async reject(queue: string, receipt: any, requeue = true): Promise<void> {
        await this.ensureConnected();
        if (requeue) {
            await this.client.rPush(this.key(queue), receipt);
        }
        await this.client.lRem(this.processingKey(queue), 1, receipt);
    }

    async length(queue: string): Promise<number> {
        await this.ensureConnected();
        return Number(await this.client.lLen(this.key(queue)));
    }

    async purge(queue: string): Promise<void> {
        await this.ensureConnected();
        await this.client.del(this.key(queue));
        await this.client.del(this.processingKey(queue));
    }

    private key(queue: string): string {
        return `${this.prefix}${queue}`;
    }

    private processingKey(queue: string): string {
        return `${this.prefix}${queue}:processing`;
    }

    private async ensureConnected(): Promise<void> {
        if (!this.connected) await this.connect();
    }
}

async function importRedis(): Promise<any> {
    try {
        // @ts-ignore - optional peer dependency, imported lazily
        return await import('redis');
    } catch (e: any) {
        throw new Error(
            'RedisQueueBackend requires the "redis" package. Install it with `bun add redis` or `npm install redis`.',
        );
    }
}
