import {ControllerMetaInterface} from "../../types/index.ts";
import {METADATA_KEYS} from "../../framework/index.ts";
import "reflect-metadata";

export function getControllerMetadata(target: any): ControllerMetaInterface {
    let metadata = Reflect.getMetadata(METADATA_KEYS.CONTROLLERS, target);
    if (!metadata) {
        metadata = {routes: [], middlewares: {}};
        Reflect.defineMetadata(METADATA_KEYS.CONTROLLERS, metadata, target);
    }

    return metadata;
}