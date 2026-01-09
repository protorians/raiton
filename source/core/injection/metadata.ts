import {METADATA_KEYS} from "@/sdk/constants";
import type {ContainerDefinitionInterface} from "@/types";
import {LifetimeEnum} from "@protorians/core";

export function getContainerMetadata(target: any): ContainerDefinitionInterface {
    if (!target[METADATA_KEYS.CONTAINER])
        target[METADATA_KEYS.CONTAINER] = {
            name: `${target.name}`,
            construct: target,
            parameters: [],
            lifetime: LifetimeEnum.TRANSIENT,
            instance: undefined,
            scope: undefined,
        } as ContainerDefinitionInterface;

    return target[METADATA_KEYS.CONTAINER];
}
