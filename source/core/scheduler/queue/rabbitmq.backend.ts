import {BaseQueueBackend, wait} from "./backend.ts";
import type {QueueDequeueOptionsInterface, QueueMessageInterface} from "../../../types/index.ts";

export interface RabbitMqQueueBackendOptions {
    url?: string;
    connection?: any;
    channel?: any;
    exchange?: string;
    persistent?: boolean;
}

/**
 * RabbitMQ-backed queue using a single AMQP channel (`sendToQueue` to publish,
 * `get` + manual ack/nack to consume).
 *
 * The `amqplib` package is imported lazily so the framework never requires it
 * unless this backend is actually used:
 *
 * ```ts
 * import {SchedulerManager, RabbitMqQueueBackend} from 'raiton/core';
 * SchedulerManager.current.registerBackend('default', new RabbitMqQueueBackend({url: 'amqp://localhost'}))
 * ```
 */
export class RabbitMqQueueBackend extends BaseQueueBackend {
    readonly name = 'rabbitmq';
    private connection: any;
    private channel: any;
    private readonly options: RabbitMqQueueBackendOptions;

    constructor(options: RabbitMqQueueBackendOptions = {}) {
        super();
        this.options = options;
    }

    async connect(): Promise<void> {
        if (this.connected) return;
        if (this.options.channel) {
            this.channel = this.options.channel;
        } else if (this.options.connection) {
            this.connection = this.options.connection;
            this.channel = await this.connection.createChannel();
        } else {
            const amqp = await importAmqplib();
            this.connection = await amqp.connect(this.options.url ?? 'amqp://localhost');
            this.channel = await this.connection.createChannel();
        }
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        if (!this.connected) return;
        if (typeof this.channel.close === 'function') await this.channel.close();
        if (this.connection && typeof this.connection.close === 'function') await this.connection.close();
        this.connected = false;
    }

    async enqueue(queue: string, message: QueueMessageInterface): Promise<string> {
        await this.ensureConnected();
        await this.channel.assertQueue(queue, {durable: true});
        this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
            persistent: this.options.persistent ?? true,
        });
        return message.id;
    }

    async dequeue(queue: string, options: QueueDequeueOptionsInterface = {}): Promise<QueueMessageInterface[]> {
        await this.ensureConnected();
        await this.channel.assertQueue(queue, {durable: true});
        const blockMs = options.blockMs ?? 0;
        const count = options.count ?? 1;
        const deadline = Date.now() + blockMs;
        const results: QueueMessageInterface[] = [];

        while (results.length < count) {
            const message = await this.channel.get(queue, {noAck: false});
            if (message) {
                const parsed = JSON.parse(message.content.toString()) as QueueMessageInterface;
                parsed.receipt = {channel: this.channel, tag: message.fields.deliveryTag};
                results.push(parsed);
                continue;
            }
            if (Date.now() >= deadline) break;
            await wait(Math.min(25, Math.max(0, deadline - Date.now())));
        }

        return results;
    }

    async acknowledge(_queue: string, receipt: any): Promise<void> {
        await this.ensureConnected();
        receipt.channel.ack(receipt.tag);
    }

    async reject(_queue: string, receipt: any, requeue = true): Promise<void> {
        await this.ensureConnected();
        receipt.channel.nack(receipt.tag, false, requeue);
    }

    async length(queue: string): Promise<number> {
        await this.ensureConnected();
        const info = await this.channel.checkQueue(queue);
        return info.messageCount;
    }

    async purge(queue: string): Promise<void> {
        await this.ensureConnected();
        await this.channel.purgeQueue(queue);
    }

    private async ensureConnected(): Promise<void> {
        if (!this.connected) await this.connect();
    }
}

async function importAmqplib(): Promise<any> {
    try {
        // @ts-ignore - optional peer dependency, imported lazily
        return await import('amqplib');
    } catch (e: any) {
        throw new Error(
            'RabbitMqQueueBackend requires the "amqplib" package. Install it with `bun add amqplib` or `npm install amqplib`.',
        );
    }
}
