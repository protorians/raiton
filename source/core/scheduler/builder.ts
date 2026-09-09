import {getSchedulerMetadata, registerScheduler, unregisterScheduler} from "./metadata.ts";
import {Injection} from "../injection/index.ts";
import {SchedulerManager} from "./manager.ts";
import {SchedulerRegistrationInterface} from "../../types/index.ts";

export function compileScheduler(SchedulerClass: any): SchedulerRegistrationInterface | undefined {
    const metadata = getSchedulerMetadata(SchedulerClass.prototype || SchedulerClass);
    const name = metadata.name || SchedulerClass.name;

    unregisterScheduler(name);
    Injection.invalidateCascade(name);

    const entry = registerScheduler(SchedulerClass);

    let instance: any;
    try {
        instance = Injection.resolve(SchedulerClass);
    } catch (e: any) {
        instance = new SchedulerClass();
    }

    SchedulerManager.current.register(name, instance, metadata.jobs || []);

    return entry;
}
