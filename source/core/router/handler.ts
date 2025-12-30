import {RouteMeta} from "@/types";
import {Parametrable} from "@/sdk";
import {Logger} from "@protorians/logger";

export function createHandler(
    instance: any,
    metadata: RouteMeta
) {
    return async (ctx: any) => {
        const args: any[] = []

        for (const p of metadata.params) {
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
                    args[p.index] =
                        ctx.req.body
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

        Logger.debug('Calling metadata handler:', metadata, args)
        Logger.debug('metadata.params:', metadata.params)
        Logger.debug('Request:', ctx.req)

        return instance[metadata.propertyKey](...args)
    }
}
