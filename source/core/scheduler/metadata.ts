import {SchedulerMetaInterface, SchedulerRegistrationInterface} from "../../types/index.ts";
import {METADATA_KEYS} from "../../framework/constants/index.ts";
import "reflect-metadata";

const registry = new Map<string, SchedulerRegistrationInterface>();

export function getSchedulerMetadata(target: any): SchedulerMetaInterface {
    let metadata = Reflect.getMetadata(METADATA_KEYS.SCHEDULER, target);
    if (!metadata) {
        metadata = {
            name: undefined,
            queue: 'default',
            timezone: undefined,
            jobs: [],
        };
        Reflect.defineMetadata(METADATA_KEYS.SCHEDULER, metadata, target);
    }
    return metadata;
}

export function registerScheduler(construct: any): SchedulerRegistrationInterface {
    const metadata: SchedulerMetaInterface = getSchedulerMetadata(construct.prototype || construct);
    const name = metadata.name || construct.name;
    const entry: SchedulerRegistrationInterface = {
        name,
        queue: metadata.queue || 'default',
        construct,
        metadata,
    };
    registry.set(name, entry);
    return entry;
}

export function unregisterScheduler(constructOrName: string | any): boolean {
    if (typeof constructOrName === 'string') {
        return registry.delete(constructOrName);
    }
    const metadata = getSchedulerMetadata(constructOrName.prototype || constructOrName);
    const name = metadata.name || constructOrName.name;
    return registry.delete(name);
}

export function getSchedulerRegistry(): Map<string, SchedulerRegistrationInterface> {
    return registry;
}

export function getScheduler(name: string): SchedulerRegistrationInterface | undefined {
    return registry.get(name);
}

export function clearSchedulerRegistry(): void {
    registry.clear();
}
