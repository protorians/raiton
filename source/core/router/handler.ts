import {ControllerMetaInterface, RouteMetaInterface} from "../../types";
import {Logger} from "@protorians/logger";
import {Raiton} from "..";
import {HttpException} from "../../framework/exceptions";
import {ThrowableResponse} from "../../framework/responses/http-throwable";
import {collectRouteArguments, validateDtoArguments, validateResponse, runMiddlewares} from "./handler.utils";
import {RaitonResponses, HttpStatus} from "../../framework";

export function createHandler(
    instance: any,
    routeMeta: RouteMetaInterface,
    controllerMeta: ControllerMetaInterface,
) {
    const handler = async (ctx: any) => {
        const isDevelopment = Raiton.thread?.builder?.options?.serve || false;
        const handlerName = `${instance.constructor.name}.${routeMeta.propertyKey}`

        try {
            const args = collectRouteArguments(instance, routeMeta, ctx);
            const middlewares = [...controllerMeta.middlewares['@'] || [], ...controllerMeta.middlewares[routeMeta.propertyKey] || []];
            await runMiddlewares(middlewares, ctx);
            await validateDtoArguments(args);
            let responses = instance[routeMeta.propertyKey](...args);
            if (responses instanceof Promise) responses = await responses;
            await validateResponse(responses, instance, routeMeta);
            return responses;
        } catch (err: any) {

            Logger.info(`${ctx.req?.method} ${ctx.req?.url}`)

            if (err instanceof HttpException || err instanceof ThrowableResponse) {
                Logger.error(`Failed to execute ${handlerName} handler`, err.message ?? err);
                ctx.reply.status(err.statusCode ?? 500)
                return err.render()
            }

            return RaitonResponses(
                err.message ?? err,
                null,
                HttpStatus.INTERNAL_SERVER_ERROR,
                {
                    error: true,
                    errorStack: isDevelopment
                        ? (typeof err.stack === 'string' ? err.stack.split('\n')
                            : [String(err.stack || err.toString() || err.message || err.name || 'Unknown error')])
                            .map((l: any) => typeof l === 'string' ? l.trim() : String(l)) : undefined
                }
            );
        }
    };

    // Attach metadata for OpenAPI generation
    (handler as any)._raitonMeta = {
        routeMeta,
        controllerMeta,
        controllerClass: instance.constructor
    };

    return handler;
}