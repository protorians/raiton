import {getControllerMetadata} from "@/core";
import {HttpMethod} from "@/sdk";
import {ControllerMeta} from "@/types";

function createRoutableMethod(method: HttpMethod) {
    return (path = '') =>
        (target: any, propertyKey: string) => {
            const meta: ControllerMeta = getControllerMetadata(target)
            meta.routes.push({
                method,
                path,
                propertyKey,
                params: meta.params[propertyKey] || []
            })
        }
}

export const Get = createRoutableMethod(HttpMethod.GET)
export const Post = createRoutableMethod(HttpMethod.POST)
export const Put = createRoutableMethod(HttpMethod.PUT)
export const Patch = createRoutableMethod(HttpMethod.PATCH)
export const Options = createRoutableMethod(HttpMethod.OPTIONS)
export const Trace = createRoutableMethod(HttpMethod.TRACE)
export const Delete = createRoutableMethod(HttpMethod.DELETE)
export const Head = createRoutableMethod(HttpMethod.HEAD)
