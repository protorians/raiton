import "reflect-metadata";
import type {ContextInterface, ParamMetaInterface} from "../../types";
import {METADATA_KEYS, Parametrable} from "..";

function createRouteParametrableDecorator(type: ParamMetaInterface['type'], callable?: (context: ContextInterface) => any) {
    return (key?: string) => {
        return (target: any, propertyKey: string, index: number) => {
            const params = Reflect.getMetadata(METADATA_KEYS.ROUTE_PARAMETERS, target.constructor) || {}
            const metatypes = Reflect.getMetadata("design:paramtypes", target, propertyKey);
            const metatype = metatypes ? metatypes[index] : undefined;

            if (!params[propertyKey]) {
                params[propertyKey] = []
            }
            params[propertyKey].push({index, type, key, callable, metatype})
            Reflect.defineMetadata(METADATA_KEYS.ROUTE_PARAMETERS, params, target.constructor)
        }
    }
}

export const Query = createRouteParametrableDecorator(Parametrable.QUERY)
export const Param = createRouteParametrableDecorator(Parametrable.PARAM)
export const Body = createRouteParametrableDecorator(Parametrable.BODY)
export const UploadedFile = createRouteParametrableDecorator(Parametrable.UPLOAD_FILE)
export const Headers = createRouteParametrableDecorator(Parametrable.HEADER)
export const Req = createRouteParametrableDecorator(Parametrable.REQ)
export const Reply = createRouteParametrableDecorator(Parametrable.REPLY)

