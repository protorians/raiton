import {ControllerMetaInterface, RouteMetaInterface} from "../../types/index.ts";
import {Logger} from "@protorians/logger";
import {Raiton} from "../index.ts";
import {HttpException} from "../../framework/exceptions/index.ts";
import {ThrowableResponse} from "../../framework/responses/http-throwable.ts";
import {collectRouteArguments, validateDtoArguments, validateResponse, runMiddlewares} from "./handler.utils.ts";
import {RouteCache, getCacheMetadata} from "../../framework/cache/index.ts";
import {RaitonResponses, HttpStatus} from "../../framework/index.ts";

export function createHandler(
    instance: any,
    routeMeta: RouteMetaInterface,
    controllerMeta: ControllerMetaInterface,
) {
    const cacheOptions = getCacheMetadata(instance, routeMeta.propertyKey);
    const routeCache = cacheOptions ? new RouteCache(routeMeta.path, cacheOptions) : undefined;

    const handler = async (ctx: any) => {
        const isDevelopment = Raiton.thread?.builder?.options?.serve || false;
        const handlerName = `${instance.constructor.name}.${routeMeta.propertyKey}`

        try {
            const cacheKey = (routeCache && routeCache.enabled && routeCache.matchesMethod(ctx.req?.method))
                ? await routeCache.key(ctx)
                : undefined;

            if (cacheKey) {
                const cached = await routeCache!.get(ctx, cacheKey);
                if (cached) {
                    ctx.reply.status(cached.status);
                    for (const [name, value] of Object.entries(cached.headers)) {
                        ctx.reply.header(name, value);
                    }
                    return cached.body;
                }
            }

            const args = collectRouteArguments(instance, routeMeta, ctx);
            const middlewares = [...controllerMeta.middlewares['@'] || [], ...controllerMeta.middlewares[routeMeta.propertyKey] || []];
            await runMiddlewares(middlewares, ctx);
            await validateDtoArguments(args);
            let responses = instance[routeMeta.propertyKey](...args);
            if (responses instanceof Promise) responses = await responses;
            await validateResponse(responses, instance, routeMeta);

            if (cacheKey && !(responses instanceof ThrowableResponse)) {
                await routeCache!.set(ctx, responses, 200, {}, cacheKey);
            }

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