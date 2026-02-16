import {ControllerMetaInterface} from "@/types";
import {METADATA_KEYS} from "@/sdk";
import "reflect-metadata";

export function getControllerMetadata(target: any): ControllerMetaInterface {
    let metadata = Reflect.getMetadata(METADATA_KEYS.CONTROLLERS, target);
    if (!metadata) {
        metadata = {routes: [], params: {}, middlewares: {}};
        Reflect.defineMetadata(METADATA_KEYS.CONTROLLERS, metadata, target);
    }

    return metadata;
}