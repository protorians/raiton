import type {IConstructor} from "@/types/contruct";
import {Injection} from "@/core/injection";
import {LifetimeEnum} from "@protorians/core";
import {getContainerMetadata} from "@/core/injection/metadata";
import {Logger} from "@protorians/logger";
import "reflect-metadata";


export function Injectable(lifetime?: LifetimeEnum, name?: string, scope?: any) {
    return function <T extends IConstructor>(target: T) {
        Injection.registry(
            name || (target as any).name,
            target,
            lifetime || LifetimeEnum.TRANSIENT,
            scope
        );
    };
}

export function Inject() {
    return function (target: any, propertyKey: string | symbol | undefined, parameterIndex?: number) {

        Logger.debug(
            'Injecting injection decorator',
            target,
            propertyKey,
            parameterIndex,
        );

        const metadata = getContainerMetadata(parameterIndex !== undefined ? target : target.constructor);

        if (parameterIndex !== undefined) {
            metadata.parameters = metadata.parameters || [];
            metadata.parameters[parameterIndex] = true;
        } else if (propertyKey !== undefined) {
            metadata.properties = metadata.properties || new Map();
            const type = Reflect.getMetadata('design:type', target, propertyKey);
            metadata.properties.set(propertyKey, type);
        }

        return target
    };
}