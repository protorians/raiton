import type {ConstructorType} from "./contruct.ts";

export type TaskTriggerType = 'cron' | 'interval' | 'timeout' | 'task';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed-out';

export type TaskPriority = 'lowest' | 'low' | 'normal' | 'high' | 'highest';

export type ScheduleInterval = number | string;

export type TaskRetryDelay = number | ((attempt: number) => number);

export interface TaskOptionsInterface {
    name?: string;
    queue?: string;
    timezone?: string;
    singleton?: boolean;
    concurrency?: number;
    retries?: number;
    retryDelay?: TaskRetryDelay;
    timeout?: number;
    catchUp?: boolean;
    enabled?: boolean;
    consume?: boolean;
    immediate?: boolean;
    priority?: TaskPriority;
    data?: any;
}

export interface CronOptionsInterface extends TaskOptionsInterface {
}

export interface IntervalOptionsInterface extends TaskOptionsInterface {
}

export interface TimeoutOptionsInterface extends TaskOptionsInterface {
}

export interface TaskDeclarationInterface extends TaskOptionsInterface {
}

export interface JobMetaInterface {
    propertyKey: string;
    name: string;
    type: TaskTriggerType;
    cron?: string;
    interval?: number;
    delay?: number;
    queue?: string;
    options: TaskOptionsInterface;
}

export interface SchedulerMetaInterface {
    name: string;
    queue: string;
    timezone?: string;
    jobs: JobMetaInterface[];
}

export interface SchedulerOptionsInterface {
    name?: string;
    queue?: string;
    timezone?: string;
}

export interface SchedulerRegistrationInterface {
    name: string;
    queue: string;
    construct: ConstructorType;
    metadata: SchedulerMetaInterface;
}

export interface TaskContextInterface<T = any> {
    id: string;
    name: string;
    queue?: string;
    payload?: T;
    data?: any;
    trigger: TaskTriggerType;
    attempt: number;
    scheduledAt: Date;
    startedAt: Date;
    scheduler: SchedulerControlInterface;
}

export interface TaskInvocationInterface {
    id: string;
    name: string;
    queue?: string;
    payload?: any;
    data?: any;
    trigger: TaskTriggerType;
    attempt: number;
    priority?: TaskPriority;
    delay?: number;
    scheduledAt: Date;
    scheduleAt?: number;
}

export interface QueueMessageInterface<T = any> {
    id: string;
    queue: string;
    payload: T;
    attempts: number;
    enqueuedAt: number;
    availableAt: number;
    receipt?: any;
}

export interface QueueDequeueOptionsInterface {
    blockMs?: number;
    count?: number;
}

export interface QueueBackendInterface {
    readonly name: string;

    connect(): Promise<void>;

    disconnect(): Promise<void>;

    enqueue(queue: string, message: QueueMessageInterface): Promise<string>;

    dequeue(queue: string, options?: QueueDequeueOptionsInterface): Promise<QueueMessageInterface[]>;

    acknowledge(queue: string, receipt: any): Promise<void>;

    reject(queue: string, receipt: any, requeue?: boolean): Promise<void>;

    length(queue: string): Promise<number>;

    purge(queue: string): Promise<void>;
}

export interface SchedulerConfigInterface {
    enabled: boolean;
    timezone: string;
    maxConcurrentJobs: number;
    defaultQueue: string;
    backend?: QueueBackendInterface;
    backends?: Record<string, QueueBackendInterface>;
}

export interface ScheduledJobInfoInterface {
    name: string;
    type: TaskTriggerType;
    queue: string;
    nextRun?: Date;
    lastRun?: Date;
    lastError?: any;
    running: number;
    runCount: number;
    failCount: number;
    paused: boolean;
    enabled: boolean;
}

export interface SchedulerControlInterface {
    enqueue(name: string, payload?: any, options?: Partial<TaskInvocationInterface>): Promise<TaskInvocationInterface>;

    dispatch(name: string, payload?: any, options?: Partial<TaskInvocationInterface>): Promise<any>;

    trigger(name: string, payload?: any, options?: Partial<TaskInvocationInterface>): Promise<any>;

    pause(name: string): void;

    resume(name: string): void;

    cancel(name: string): boolean;

    getJobs(): ScheduledJobInfoInterface[];

    getJob(name: string): ScheduledJobInfoInterface | undefined;

    has(name: string): boolean;

    start(): Promise<void>;

    stop(): Promise<void>;
}
