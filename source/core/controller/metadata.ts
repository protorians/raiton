import {ControllerMeta} from "@/types";
import {METADATA_KEYS} from "@/sdk";


export function getControllerMetadata(target: any): ControllerMeta {
    if (!target[METADATA_KEYS.CONTROLLERS])
        target[METADATA_KEYS.CONTROLLERS] = {routes: [], params: {}}

    return target[METADATA_KEYS.CONTROLLERS]
}