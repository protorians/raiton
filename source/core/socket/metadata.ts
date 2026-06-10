import {SocketMetaInterface} from "../../types";
import {METADATA_KEYS} from "../../framework";
import "reflect-metadata";

export function getSocketMetadata(target: any): SocketMetaInterface {
    let metadata = Reflect.getMetadata(METADATA_KEYS.SOCKETS, target);
    if (!metadata) {
        metadata = { namespace: '/', events: [] };
        Reflect.defineMetadata(METADATA_KEYS.SOCKETS, metadata, target);
    }

    return metadata;
}
