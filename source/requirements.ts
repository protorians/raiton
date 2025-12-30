import dotenv from "dotenv";
import path from "node:path";
import {EventBus, EventBusEnum} from "@protorians/events-bus";

dotenv.config({
    path: path.join(process.cwd(), '.env'),
    debug: false,
    quiet: true,
});

// @ts-ignore
process.env.RAITON_NATURAL_MODE = !!process[Symbol.for("ts-node.register.instance")];


/**
 * Process Events caching
 */
process.on('beforeExit', (code) => EventBus.dispatch(EventBusEnum.SERVER_SHUTDOWN, {code}));
// process.on('exit', (code) => EventBus.dispatch(EventBusEnum.SYSTEM_SERVER_SHUTDOWN, {code}));
process.on('SIGINT', (code) => {
    EventBus.dispatch(EventBusEnum.SERVER_STOPPED, {code})
    process.exit(1);
});
process.on('SIGTERM', (code) => {
    EventBus.dispatch(EventBusEnum.SERVER_STOPPED, {code})
    process.exit(1);
});