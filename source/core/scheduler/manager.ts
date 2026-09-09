import type {
    JobMetaInterface,
    QueueBackendInterface,
    QueueMessageInterface,
    SchedulerConfigInterface,
    SchedulerControlInterface,
    ScheduledJobInfoInterface,
    TaskContextInterface,
    TaskInvocationInterface,
    TaskTriggerType,
} from "../../types/index.ts";
import {TaskTriggerEnum} from "../../framework/enums/index.ts";
import {Logger} from "@protorians/logger";
import {CronSchedule, CronScheduleInterface} from "./cron.ts";
import {MemoryQueueBackend, wait} from "./queue/backend.ts";
import {parseDuration} from "./duration.ts";

interface JobRuntime {
    name: string;
    type: TaskTriggerType;
    instance: any;
    propertyKey: string;
    handler: (ctx: TaskContextInterface) => any;
    options: JobOptions;
    queue: string;
    cron?: CronScheduleInterface;
    interval?: number;
    delay?: number;
    running: number;
    lastRun?: Date;
    nextRun?: Date;
    lastError?: any;
    runCount: number;
    failCount: number;
    paused: boolean;
    missed: boolean;
    timer?: ReturnType<typeof setTimeout>;
}

interface JobOptions {
    singleton: boolean;
    concurrency: number;
    retries: number;
    retryDelay?: number | ((attempt: number) => number);
    timeout?: number;
    catchUp: boolean;
    enabled: boolean;
    consume: boolean;
    immediate: boolean;
    priority?: string;
    data?: any;
}

const DEFAULT_CONFIG: SchedulerConfigInterface = {
    enabled: true,
    timezone: 'UTC',
    maxConcurrentJobs: 100,
    defaultQueue: 'default',
};

export class SchedulerManager implements SchedulerControlInterface {
    private static _instance: SchedulerManager;

    private readonly _config: SchedulerConfigInterface = {...DEFAULT_CONFIG};
    private readonly _backends = new Map<string, QueueBackendInterface>();
    private readonly _queueBackends = new Map<string, string>();
    private readonly _jobs = new Map<string, JobRuntime>();
    private readonly _timers = new Set<ReturnType<typeof setTimeout>>();
    private readonly _consumers = new Set<Promise<void>>();
    private _defaultBackend: QueueBackendInterface;
    private _running = false;
    private _booted = false;

    constructor() {
        this._defaultBackend = new MemoryQueueBackend();
        this._backends.set(this._defaultBackend.name, this._defaultBackend);
    }

    static get current(): SchedulerManager {
        if (!SchedulerManager._instance) {
            SchedulerManager._instance = new SchedulerManager();
        }
        return SchedulerManager._instance;
    }

    get enabled(): boolean {
        return this._config.enabled;
    }

    get running(): boolean {
        return this._running;
    }

    configure(config: Partial<SchedulerConfigInterface>): this {
        Object.assign(this._config, config);
        if (config.backend) {
            this._defaultBackend = config.backend;
            this._backends.set(config.backend.name, config.backend);
        }
        if (config.backends) {
            for (const [name, backend] of Object.entries(config.backends)) {
                this._backends.set(name, backend);
            }
        }
        return this;
    }

    registerBackend(name: string, backend: QueueBackendInterface): this {
        this._backends.set(name, backend);
        if (!this._defaultBackend || this._backends.size === 1) {
            this._defaultBackend = backend;
        }
        return this;
    }

    getBackend(queue?: string): QueueBackendInterface {
        if (queue) {
            const backendName = this._queueBackends.get(queue);
            if (backendName) {
                const backend = this._backends.get(backendName);
                if (backend) return backend;
            }
        }
        return this._defaultBackend;
    }

    mapQueue(queue: string, backendName: string): this {
        this._queueBackends.set(queue, backendName);
        return this;
    }

    get backends(): Map<string, QueueBackendInterface> {
        return this._backends;
    }

    register(name: string, instance: any, jobs: JobMetaInterface[]): this {
        for (const meta of jobs) {
            const handler = typeof instance[meta.propertyKey] === 'function'
                ? instance[meta.propertyKey].bind(instance)
                : undefined;

            if (!handler) {
                Logger.warn(`Scheduler: method "${meta.propertyKey}" not found on "${name}".`);
                continue;
            }

            const job: JobRuntime = {
                name: meta.name,
                type: meta.type,
                instance,
                propertyKey: meta.propertyKey,
                handler,
                options: this.resolveOptions(meta),
                queue: meta.queue || 'default',
                cron: meta.cron ? new CronSchedule(meta.cron, meta.options.timezone ?? this._config.timezone) : undefined,
                interval: meta.interval,
                delay: meta.delay,
                running: 0,
                runCount: 0,
                failCount: 0,
                paused: false,
                missed: false,
            };

            const existing = this._jobs.get(job.name);
            if (existing) {
                this.clearTimer(existing);
                existing.paused = true;
            }

            this._jobs.set(job.name, job);

            if (this._running) {
                this.startJob(job);
            }
        }
        return this;
    }

    async start(): Promise<void> {
        if (!this._config.enabled || this._booted) return;

        for (const backend of this._backends.values()) {
            await backend.connect();
        }

        this._running = true;
        this._booted = true;

        for (const job of this._jobs.values()) {
            this.startJob(job);
        }

        Logger.info(`Scheduler started with ${this._jobs.size} registered job(s).`);
    }

    async stop(): Promise<void> {
        if (!this._booted) return;
        this._running = false;

        for (const timer of this._timers) {
            clearTimeout(timer);
        }
        this._timers.clear();

        for (const job of this._jobs.values()) {
            if (job.timer) clearTimeout(job.timer);
            job.timer = undefined;
            job.paused = true;
        }

        await Promise.allSettled(this._consumers);
        this._consumers.clear();

        for (const backend of this._backends.values()) {
            await backend.disconnect();
        }

        this._booted = false;
        Logger.info('Scheduler stopped.');
    }

    has(name: string): boolean {
        return this._jobs.has(name);
    }

    getJob(name: string): ScheduledJobInfoInterface | undefined {
        const job = this._jobs.get(name);
        return job ? this.info(job) : undefined;
    }

    getJobs(): ScheduledJobInfoInterface[] {
        return Array.from(this._jobs.values()).map(job => this.info(job));
    }

    async enqueue(name: string, payload?: any, options: Partial<TaskInvocationInterface> = {}): Promise<TaskInvocationInterface> {
        const job = this._jobs.get(name);
        if (!job) throw new Error(`Task "${name}" is not registered.`);

        const queue = options.queue ?? job.queue ?? this._config.defaultQueue;
        const backend = this.getBackend(queue);

        const message: QueueMessageInterface = {
            id: options.id ?? randomId(),
            queue,
            payload: options.payload ?? payload,
            attempts: options.attempt ?? 0,
            enqueuedAt: Date.now(),
            availableAt: options.scheduleAt ?? Date.now(),
        };

        await backend.enqueue(queue, message);

        return {
            id: message.id,
            name,
            queue,
            payload: message.payload,
            data: options.data ?? job.options.data,
            trigger: options.trigger ?? TaskTriggerEnum.Task,
            attempt: message.attempts,
            priority: options.priority,
            delay: options.delay,
            scheduledAt: options.scheduledAt ?? new Date(),
            scheduleAt: options.scheduleAt,
        };
    }

    async dispatch(name: string, payload?: any, options: Partial<TaskInvocationInterface> = {}): Promise<any> {
        const job = this._jobs.get(name);
        if (!job) throw new Error(`Task "${name}" is not registered.`);

        const ctx = this.buildContext(job, options.payload ?? payload, options.trigger ?? TaskTriggerEnum.Task, options.attempt ?? 0, options.id);
        return this.dispatchNow(job, ctx);
    }

    async trigger(name: string, payload?: any, options: Partial<TaskInvocationInterface> = {}): Promise<any> {
        return this.dispatch(name, payload, options);
    }

    pause(name: string): void {
        const job = this._jobs.get(name);
        if (!job || job.paused) return;
        job.paused = true;
        this.clearTimer(job);
    }

    resume(name: string): void {
        const job = this._jobs.get(name);
        if (!job || !job.paused) return;
        job.paused = false;
        if (this._running) this.startJob(job);
    }

    cancel(name: string): boolean {
        const job = this._jobs.get(name);
        if (!job) return false;
        this.clearTimer(job);
        this._jobs.delete(name);
        return true;
    }

    private resolveOptions(meta: JobMetaInterface): JobOptions {
        const options = meta.options || {};
        return {
            singleton: options.singleton ?? true,
            concurrency: options.concurrency ?? 1,
            retries: options.retries ?? 0,
            retryDelay: options.retryDelay,
            timeout: options.timeout,
            catchUp: options.catchUp ?? false,
            enabled: options.enabled ?? true,
            consume: options.consume ?? false,
            immediate: options.immediate ?? false,
            priority: options.priority,
            data: options.data,
        };
    }

    private startJob(job: JobRuntime): void {
        if (!job.options.enabled) return;

        if (job.options.consume) {
            this._consumers.add(this.consume(job));
        }

        switch (job.type) {
            case TaskTriggerEnum.Cron:
                this.armCron(job);
                break;
            case TaskTriggerEnum.Interval:
                this.armInterval(job);
                if (job.options.immediate) {
                    this.dispatchNow(job, this.buildContext(job, undefined, TaskTriggerEnum.Interval)).catch((e: any) => {
                        Logger.error(`Task "${job.name}" failed`, e?.message ?? e);
                    });
                }
                break;
            case TaskTriggerEnum.Timeout:
                this.armTimeout(job);
                break;
            case TaskTriggerEnum.Task:
                break;
        }
    }

    private armCron(job: JobRuntime): void {
        const next = job.cron?.next(new Date());
        if (!next) return;
        job.nextRun = next;
        const delay = Math.max(0, next.getTime() - Date.now());
        job.timer = setTimeout(() => {
            this._timers.delete(job.timer!);
            this.tick(job, TaskTriggerEnum.Cron);
        }, delay);
        this._timers.add(job.timer);
    }

    private armInterval(job: JobRuntime): void {
        const interval = job.interval ?? parseDuration(0);
        job.nextRun = new Date(Date.now() + interval);
        job.timer = setTimeout(() => {
            this._timers.delete(job.timer!);
            this.tick(job, TaskTriggerEnum.Interval);
        }, interval);
        this._timers.add(job.timer);
    }

    private armTimeout(job: JobRuntime): void {
        const delay = job.delay ?? 0;
        job.nextRun = new Date(Date.now() + delay);
        job.timer = setTimeout(() => {
            this._timers.delete(job.timer!);
            this.tick(job, TaskTriggerEnum.Timeout);
        }, delay);
        this._timers.add(job.timer);
    }

    private tick(job: JobRuntime, trigger: TaskTriggerType): void {
        if (!this._running || job.paused || !this._jobs.has(job.name)) return;

        if (trigger === TaskTriggerEnum.Cron) {
            this.armCron(job);
        } else if (trigger === TaskTriggerEnum.Interval) {
            this.armInterval(job);
        }

        const ctx = this.buildContext(job, undefined, trigger);
        this.dispatchNow(job, ctx).catch((e: any) => {
            Logger.error(`Task "${job.name}" failed`, e?.message ?? e);
        });
    }

    private async dispatchNow(job: JobRuntime, ctx: TaskContextInterface): Promise<any> {
        if (!this._running && ctx.trigger !== TaskTriggerEnum.Task) return undefined;

        if (job.options.singleton && job.running > 0) {
            if (job.options.catchUp) job.missed = true;
            return undefined;
        }

        const result = await this.runOnce(job, ctx);

        if (job.missed) {
            job.missed = false;
            setTimeout(() => {
                if (this._jobs.has(job.name)) {
                    this.dispatchNow(job, this.buildContext(job, undefined, ctx.trigger)).catch(() => { /* noop */ });
                }
            }, 0);
        }

        return result;
    }

    private async runOnce(job: JobRuntime, ctx: TaskContextInterface): Promise<any> {
        job.running += 1;
        job.lastRun = new Date();
        job.runCount += 1;

        const maxAttempts = job.options.retries;
        let attempt = 0;

        try {
            while (true) {
                ctx.attempt = attempt;
                ctx.startedAt = new Date();
                try {
                    return await withTimeout(job.handler(ctx), job.options.timeout);
                } catch (e) {
                    attempt += 1;
                    if (attempt > maxAttempts) {
                        job.failCount += 1;
                        job.lastError = e;
                        throw e;
                    }
                    const delay = resolveRetryDelay(job.options.retryDelay, attempt);
                    if (delay > 0) await wait(delay);
                }
            }
        } finally {
            job.running -= 1;
        }
    }

    private async consume(job: JobRuntime): Promise<void> {
        const backend = this.getBackend(job.queue);
        const count = Math.max(1, job.options.concurrency);

        while (this._running && this._jobs.get(job.name) === job) {
            try {
                const messages = await backend.dequeue(job.queue, {blockMs: 1000, count});
                if (messages.length === 0) continue;

                await Promise.all(messages.map(message => this.processMessage(job, backend, message)));
            } catch (e: any) {
                if (this._running) Logger.error(`Queue consumer "${job.name}" error`, e?.message ?? e);
                await wait(1000);
            }
        }
    }

    private async processMessage(job: JobRuntime, backend: QueueBackendInterface, message: QueueMessageInterface): Promise<void> {
        const ctx = this.buildContext(job, message.payload, TaskTriggerEnum.Task, message.attempts, message.id);
        ctx.scheduledAt = new Date(message.enqueuedAt ?? Date.now());

        try {
            await this.runOnce(job, ctx);
            await backend.acknowledge(job.queue, message.receipt);
        } catch (e: any) {
            await backend.reject(job.queue, message.receipt, false);
        }
    }

    private buildContext(job: JobRuntime, payload: any, trigger: TaskTriggerType, attempt = 0, id?: string): TaskContextInterface {
        return {
            id: id ?? randomId(),
            name: job.name,
            queue: job.queue,
            payload,
            data: job.options.data,
            trigger,
            attempt,
            scheduledAt: new Date(),
            startedAt: new Date(),
            scheduler: this,
        };
    }

    private info(job: JobRuntime): ScheduledJobInfoInterface {
        return {
            name: job.name,
            type: job.type,
            queue: job.queue,
            nextRun: job.nextRun,
            lastRun: job.lastRun,
            lastError: job.lastError,
            running: job.running,
            runCount: job.runCount,
            failCount: job.failCount,
            paused: job.paused,
            enabled: job.options.enabled,
        };
    }

    private clearTimer(job: JobRuntime): void {
        if (job.timer) {
            clearTimeout(job.timer);
            this._timers.delete(job.timer);
            job.timer = undefined;
        }
    }
}

async function withTimeout<T>(promise: Promise<T>, timeout?: number): Promise<T> {
    if (!timeout || timeout <= 0) return promise;
    let timer: ReturnType<typeof setTimeout>;

    const guard = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Task timed out after ${timeout}ms`)), timeout);
    });

    try {
        return await Promise.race([promise, guard]);
    } finally {
        clearTimeout(timer!);
    }
}

function resolveRetryDelay(delay: number | ((attempt: number) => number) | undefined, attempt: number): number {
    if (typeof delay === 'function') return delay(attempt);
    if (typeof delay === 'number') return delay;
    return 0;
}

function randomId(): string {
    const g = globalThis as any;
    if (g.crypto && typeof g.crypto.randomUUID === 'function') {
        return g.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
