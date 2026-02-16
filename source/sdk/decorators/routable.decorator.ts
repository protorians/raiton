import {getControllerMetadata} from "@/core";
import {HttpMethod} from "@/sdk";
import {ControllerMetaInterface, RouteDecoratorCallable, RouteMetaInterface} from "@/types";
import path from "node:path";


function stabilizeRoute(meta: ControllerMetaInterface, {path, method, propertyKey}: Partial<RouteMetaInterface>) {
    return {
        ...meta.routes.filter(route => (route.path === path && route.method === method) || (route.propertyKey === propertyKey))[0] || {},
        method,
        path,
        propertyKey,
        params: (propertyKey ? meta.params[propertyKey] : []) || [],
    } as RouteMetaInterface;
}

export function createRoutableDecorator(method: HttpMethod) {
    return (path = '') =>
        (target: any, propertyKey: string) => {
            const meta: ControllerMetaInterface = getControllerMetadata(target);
            const route = stabilizeRoute(meta, {
                method,
                path,
                propertyKey,
                params: meta.params[propertyKey] || [],
            });
            meta.routes.push(route)
        }
}

export function createRouteDecorator(callable: RouteDecoratorCallable) {
    return (target: any, propertyKey: string) => {
        const controller: ControllerMetaInterface = getControllerMetadata(target);
        const route: RouteMetaInterface = stabilizeRoute(controller, {propertyKey})
        const index = controller.routes.findIndex(route => route.propertyKey === propertyKey)

        callable({controller, route, index})
    }
}

export const Get = createRoutableDecorator(HttpMethod.GET)
export const Post = createRoutableDecorator(HttpMethod.POST)
export const Put = createRoutableDecorator(HttpMethod.PUT)
export const Patch = createRoutableDecorator(HttpMethod.PATCH)
export const Options = createRoutableDecorator(HttpMethod.OPTIONS)
export const Trace = createRoutableDecorator(HttpMethod.TRACE)
export const Delete = createRoutableDecorator(HttpMethod.DELETE)
export const Head = createRoutableDecorator(HttpMethod.HEAD)
