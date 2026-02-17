import {ControllerMetaInterface, MiddlewareCallable, ParamMetaInterface, RouteMetaInterface} from "@/types";
import {METADATA_KEYS, Parametrable} from "@/sdk";
import {Logger} from "@protorians/logger";
import {middlewareCompose, Raiton} from "@/core";
import {DataTransferObject} from "@/sdk/data-transfer-object";
import {Throwable} from "@/sdk/exceptions/throwable";
import {HttpException} from "@/sdk/exceptions";
import {ThrowableResponse} from "@/sdk/responses/http-throwable";

export function createHandler(
    instance: any,
    routeMeta: RouteMetaInterface,
    controllerMeta: ControllerMetaInterface,
) {
    return async (ctx: any) => {
        const isDevelopment = Raiton.thread?.builder?.options?.development || false;
        const handlerName = `${instance.constructor.name}.${routeMeta.propertyKey}`

        try {
            const args: any[] = []
            const params: ParamMetaInterface[] = Reflect.getMetadata(METADATA_KEYS.ROUTE_PARAMETERS, instance.constructor)?.[routeMeta.propertyKey] || []

            for (const p of params) {

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
                        if (p.metatype && 'prototype' in p.metatype) {
                            ctx.req.body = new p.metatype(ctx.req.body)
                        }
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

            /**
             * Middlewares running order
             */
            const middlewares: MiddlewareCallable[] = [
                ...controllerMeta.middlewares['@'] || [],
                ...controllerMeta.middlewares[routeMeta.propertyKey] || []
            ]
            if (middlewares.length > 0) await middlewareCompose(middlewares)(ctx)

            /**
             * Vérification des arguments
             */
            for (const input of args) {
                /** DTO validation */
                if (input instanceof DataTransferObject) {
                    const errors = await input.validation(false);
                    if (errors && errors.length) {
                        const stack = Object.values(errors[0].constraints || {})
                        throw new Throwable(stack.join(';'), 500)
                    }
                }
            }

            let responses = instance[routeMeta.propertyKey](...args)
            if (responses instanceof Promise) responses = await responses

            return responses;
        } catch (err: any) {

            if (!(err instanceof ThrowableResponse)) {
                Logger.error(`Failed to execute ${handlerName} handler`, err.message ?? err);
                ctx.reply.status(500)
            }

            if (err instanceof ThrowableResponse) {
                ctx.reply.status(err.statusCode || 201)
            }

            if (err instanceof HttpException || err instanceof ThrowableResponse)
                return err.render()

            return {
                statusCode: 500,
                error: true,
                message: err.message ?? err,
                data: null,
                stack: isDevelopment
                    ? (typeof err.stack === 'string' ? err.stack.split('\n')
                        : [String(err.stack || err.toString() || err.message || err.name || 'Unknown error')])
                        .map((l: any) => typeof l === 'string' ? l.trim() : String(l)) : undefined
                ,
            }
        }
    }
}
