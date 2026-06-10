import {MiddlewareCallable} from "../../types";
import {getControllerMetadata} from "../../core";


export function Middleware(middleware: MiddlewareCallable) {
    return (target: any, propertyKey?: string) => {
        const meta = getControllerMetadata(target.prototype || target)
        const segment = propertyKey ? propertyKey : '@'
        meta.middlewares[segment] = [...(meta.middlewares[segment] || []), middleware];
    }
}

export function createMiddlewareDecoration(middleware: MiddlewareCallable) {
    return Middleware(middleware);
}