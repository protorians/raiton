import "reflect-metadata";
import type {IConstructor} from "@/types/contruct";
import {Injection} from "@/core/injection";
import {LifetimeEnum} from "@protorians/core";
import {Logger} from "@protorians/logger";
import {METADATA_KEYS} from "@/sdk/constants";


export function Injectable(lifetime?: LifetimeEnum, name?: string, scope?: any) {
    return function <T extends IConstructor>(target: T) {
        const metadata = {
            name: name || target.name,
            construct: target,
            lifetime: lifetime || LifetimeEnum.TRANSIENT,
            scope
        };
        Reflect.defineMetadata(METADATA_KEYS.CONTAINER, metadata, target);
        Injection.registry(
            metadata.name,
            target,
            metadata.lifetime,
            scope
        );
    };
}

export function Inject(token?: any) {
    return function (target: any, propertyKey: string | symbol | undefined, parameterIndex?: number) {
        if (parameterIndex !== undefined) {
            const parameters = Reflect.getMetadata(METADATA_KEYS.INJECT_PARAMETERS, target) || [];
            parameters[parameterIndex] = token || true;
            Reflect.defineMetadata(METADATA_KEYS.INJECT_PARAMETERS, parameters, target);
        } else if (propertyKey !== undefined) {
            const properties = Reflect.getMetadata(METADATA_KEYS.INJECT_PROPERTIES, target.constructor) || new Map();
            const type = token || Reflect.getMetadata('design:type', target, propertyKey);

            if (type === undefined || type === Object) {
                Logger.warn(`Injection: impossible de déterminer le type pour la propriété "${String(propertyKey)}" de ${target.constructor.name}. Assurez-vous d'utiliser un token ou que le type est une classe.`);
            }

            properties.set(propertyKey, type);
            Reflect.defineMetadata(METADATA_KEYS.INJECT_PROPERTIES, properties, target.constructor);
        }
        return target;
    };
}