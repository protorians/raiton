import {METADATA_KEYS} from "@/sdk/constants";
import type {ContainerDefinitionInterface} from "@/types";
import {LifetimeEnum} from "@protorians/core";
import "reflect-metadata";

export function getContainerMetadata(target: any): ContainerDefinitionInterface {
    let metadata = Reflect.getMetadata(METADATA_KEYS.CONTAINER, target);

    if (!metadata) {
        metadata = {
            name: `${target.name}`,
            construct: target,
            parameters: [],
            lifetime: LifetimeEnum.TRANSIENT,
            instance: undefined,
            scope: undefined,
        } as ContainerDefinitionInterface;
        Reflect.defineMetadata(METADATA_KEYS.CONTAINER, metadata, target);
    }

    return metadata;
}
