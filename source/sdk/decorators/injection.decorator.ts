import type {IConstructor} from "@/types/contruct";
import {Injection} from "@/core/injection";
import {LifetimeEnum} from "@protorians/core";
import {getContainerMetadata} from "@/core/injection/metadata";
import {Logger} from "@protorians/logger";


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

export function Inject(injectable?: any) {
    return function (target: any, propertyKey: string | symbol | undefined, parameterIndex?: number) {

        Logger.debug(
            'Injecting injection decorator',
            target,
            propertyKey,
            parameterIndex,
        );

        const name = injectable?.name || injectable;
        const metadata = getContainerMetadata(target);

        if (parameterIndex !== undefined) {
            metadata.parameters = metadata.parameters || [];
            metadata.parameters[parameterIndex] = name || propertyKey;
        }

        return target
    };
}