import "reflect-metadata";
import {getSchedulerMetadata, registerScheduler, unregisterScheduler} from "../../core/scheduler/index.ts";
import {Injectable} from "./index.ts";
import {LifetimeEnum} from "@protorians/core";
import {parseDuration} from "../../core/scheduler/duration.ts";
import {TaskTriggerEnum} from "../enums/index.ts";
import type {
    CronOptionsInterface,
    IntervalOptionsInterface,
    JobMetaInterface,
    SchedulerOptionsInterface,
    TaskDeclarationInterface,
    TimeoutOptionsInterface,
} from "../../types/index.ts";

/**
 * Marks a class as a scheduler: a container for scheduled jobs
 * ({@link Cron}, {@link Every}, {@link Timeout}) and named tasks
 * ({@link Task}).
 *
 * @example
 * ```ts
 * @Scheduler({ name: 'maintenance', queue: 'default' })
 * class MaintenanceScheduler {
 *   @Cron('0 0 * * *', { name: 'daily-cleanup' })
 *   async cleanup(ctx: TaskContextInterface) { ... }
 *
 *   @Every('5m', { name: 'heartbeat' })
 *   async heartbeat() { ... }
 *
 *   @Task('send-email', { consume: true, queue: 'emails' })
 *   async sendEmail(ctx: TaskContextInterface<Email>) { ... }
 * }
 * ```
 */
export function Scheduler(options: SchedulerOptionsInterface = {}) {
    return (target: any) => {
        const name = options.name || target.name;
        Injectable(LifetimeEnum.TRANSIENT, name)(target);

        const meta = getSchedulerMetadata(target.prototype || target);
        meta.name = name;
        meta.queue = options.queue || 'default';
        meta.timezone = options.timezone;

        unregisterScheduler(name);
        registerScheduler(target);
    };
}

/**
 * Schedule a method using a cron expression (5 or 6 fields).
 */
export function Cron(expression: string, options: CronOptionsInterface = {}) {
    return (target: any, propertyKey: string) => {
        const meta = getSchedulerMetadata(target);
        const job: JobMetaInterface = {
            propertyKey,
            name: options.name || `${meta.name}:${propertyKey}`,
            type: TaskTriggerEnum.Cron,
            cron: expression,
            queue: options.queue,
            options,
        };
        meta.jobs.push(job);
    };
}

/**
 * Schedule a method at a fixed interval. `interval` is a number of
 * milliseconds or a human-readable duration such as `"5s"` or `"1h"`.
 */
export function Every(interval: number | string, options: IntervalOptionsInterface = {}) {
    return (target: any, propertyKey: string) => {
        const meta = getSchedulerMetadata(target);
        const job: JobMetaInterface = {
            propertyKey,
            name: options.name || `${meta.name}:${propertyKey}`,
            type: TaskTriggerEnum.Interval,
            interval: parseDuration(interval),
            queue: options.queue,
            options,
        };
        meta.jobs.push(job);
    };
}

/**
 * Schedule a one-shot method after a delay. `delay` is a number of
 * milliseconds or a human-readable duration such as `"30s"`.
 */
export function Timeout(delay: number | string, options: TimeoutOptionsInterface = {}) {
    return (target: any, propertyKey: string) => {
        const meta = getSchedulerMetadata(target);
        const job: JobMetaInterface = {
            propertyKey,
            name: options.name || `${meta.name}:${propertyKey}`,
            type: TaskTriggerEnum.Timeout,
            delay: parseDuration(delay),
            queue: options.queue,
            options,
        };
        meta.jobs.push(job);
    };
}

/**
 * Register a named task. Tasks are dispatachable in-process
 * (`SchedulerManager.current.dispatch(name, payload)`), enqueueable on a
 * queue backend (`SchedulerManager.current.enqueue(name, payload)`) and,
 * when `options.consume` is `true`, consumed from the queue as a worker.
 *
 * @example
 * ```ts
 * @Scheduler()
 * class Jobs {
 *   @Task('email:welcome', { queue: 'emails', consume: true, retries: 3 })
 *   async welcome(ctx: TaskContextInterface) { ... }
 * }
 * ```
 */
export function Task(name: string, options: TaskDeclarationInterface = {}) {
    return (target: any, propertyKey: string) => {
        const meta = getSchedulerMetadata(target);
        const job: JobMetaInterface = {
            propertyKey,
            name,
            type: TaskTriggerEnum.Task,
            queue: options.queue,
            options: {
                ...options,
                name,
            },
        };
        meta.jobs.push(job);
    };
}

export {Every as Interval};
