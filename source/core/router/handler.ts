import {ControllerMetaInterface, MiddlewareCallable, RouteMetaInterface} from "@/types";
import {Parametrable} from "@/sdk";
import {Logger} from "@protorians/logger";
import {Throwable} from "@/sdk/throwable";
import {middlewareCompose} from "@/core";

export function createHandler(
    instance: any,
    routeMeta: RouteMetaInterface,
    controllerMeta: ControllerMetaInterface,
) {
    return async (ctx: any) => {
        const args: any[] = []

        for (const p of routeMeta.params) {

            switch (p.type) {
                case Parametrable.QUERY:
                    args[p.index] =
                        ctx.req.query?.[p.key!]
                    break
                case Parametrable.PARAM:
                    args[p.index] =
                        ctx.req.params?.[p.key!] ?? ctx.params?.[p.key!]
                    break
                case Parametrable.BODY:
                    args[p.index] = ctx.req.body
                    break
                case Parametrable.HEADER:
                    args[p.index] = ctx.req.headers[p.key!.toLowerCase()] as any;
                    break
                case Parametrable.REQ:
                    args[p.index] = ctx.req
                    break
                case Parametrable.REPLY:
                    args[p.index] = ctx.REPLY
                    break
                case Parametrable.UPLOAD_FILE:
                    args[p.index] = ctx.req.file
                    break
                case Parametrable.CUSTOM:
                    args[p.index] = p.callable?.(ctx) ?? null;
                    break;
            }
        }

        if (!(routeMeta.propertyKey in instance))
            throw new Throwable(`${routeMeta.propertyKey} does not exist`)

        const middlewares: MiddlewareCallable[] = [
            ...controllerMeta.middlewares['@'] || [],
            ...controllerMeta.middlewares[routeMeta.propertyKey] || []
        ]

        if (middlewares.length > 0) await middlewareCompose(middlewares)(ctx)

        return instance[routeMeta.propertyKey](...args)
    }
}
