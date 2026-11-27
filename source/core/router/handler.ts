import {ControllerMetaInterface, RouteMetaInterface} from "../../types/index.ts";
import {Logger} from "@protorians/logger";
import {Raiton} from "../index.ts";
import {HttpException} from "../../framework/exceptions/index.ts";
import {ThrowableResponse} from "../../framework/responses/http-throwable.ts";
import {collectRouteArguments, validateDtoArguments, validateResponse, runMiddlewares} from "./handler.utils.ts";
import {RouteCache, getCacheMetadata} from "../../framework/cache/index.ts";
import {RaitonResponses, HttpStatus} from "../../framework/index.ts";
import {RaitonConfig} from "../config/index.ts";
import {
    ContractValidationError,
    getRouteContract,
    OutputContractError,
    validateRouteInput,
    validateRouteOutput,
} from "../../contracts/index.ts";
import {enrichErrorPayload, errorPayload} from "../../framework/errors/catalog.ts";

function isDevelopment(): boolean {
    return Boolean(
        Raiton.thread?.builder?.options?.hmr
        || RaitonConfig.get("develop")
        || process.env.NODE_ENV === "development"
    );
}

export function createHandler(
    instance: any,
    routeMeta: RouteMetaInterface,
    controllerMeta: ControllerMetaInterface,
) {
    const cacheOptions = getCacheMetadata(instance, routeMeta.propertyKey);
    const routeCache = cacheOptions ? new RouteCache(routeMeta.path, cacheOptions) : undefined;
    const contract = getRouteContract(instance.constructor, routeMeta.propertyKey);
    const routeLabel = `${routeMeta.method} ${controllerMeta.prefix ?? ""}${routeMeta.path}`;

    const handler = async (ctx: any) => {
        const development = isDevelopment();
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

            const middlewares = [...controllerMeta.middlewares['@'] || [], ...controllerMeta.middlewares[routeMeta.propertyKey] || []];
            await runMiddlewares(middlewares, ctx);

            // Schema-first input validation runs before the handler and before
            // DTO construction: an invalid payload never reaches user code.
            if (contract?.input) {
                const input = await validateRouteInput(contract, ctx);
                if (!input.success) throw new ContractValidationError(input.issues);
                if (input.body !== undefined) ctx.req.body = input.body;
            }

            const args = collectRouteArguments(instance, routeMeta, ctx);
            await validateDtoArguments(args);
            let responses = instance[routeMeta.propertyKey](...args);
            if (responses instanceof Promise) responses = await responses;

            if (contract?.output && RaitonConfig.shouldValidateResponses(development)) {
                const output = await validateRouteOutput(contract, responses);
                if (!output.success) {
                    Logger.error(
                        `[contract] ${routeLabel} returned an invalid response` +
                        (ctx.state?.requestId ? ` request_id=${ctx.state.requestId}` : '') +
                        `: ` + output.issues.map(issue => `${issue.path || "<root>"} (${issue.code})`).join(", ")
                    );
                    if (development) throw new OutputContractError(routeLabel, output.issues);
                }
            }

            await validateResponse(responses, instance, routeMeta);

            if (cacheKey && !(responses instanceof ThrowableResponse)) {
                await routeCache!.set(ctx, responses, 200, {}, cacheKey);
            }

            return responses;
        } catch (err: any) {

            const requestId = ctx.state?.requestId
            Logger.info(`${ctx.req?.method} ${ctx.req?.url}${requestId ? ` request_id=${requestId}` : ''}`)

            if (err instanceof ContractValidationError || err instanceof OutputContractError) {
                Logger.warn(`[contract] ${routeLabel} rejected request${requestId ? ` request_id=${requestId}` : ''}`);
                ctx.reply.status(err.statusCode);
                return err.render();
            }

            if (err instanceof HttpException || err instanceof ThrowableResponse) {
                Logger.error(`Failed to execute ${handlerName} handler${requestId ? ` request_id=${requestId}` : ''}`, err.message ?? err);
                const status = err.statusCode ?? 500;
                ctx.reply.status(status)
                return enrichErrorPayload(err.render(), status, ctx.state?.requestId)
            }

            ctx.reply.status(HttpStatus.INTERNAL_SERVER_ERROR);
            return errorPayload("INTERNAL_SERVER_ERROR", {
                requestId: ctx.state?.requestId,
                ...(development ? {details: {message: String(err?.message ?? err)}} : {}),
            });
        }
    };

    // Attach metadata for OpenAPI generation and CLI introspection.
    (handler as any)._raitonMeta = {
        routeMeta,
        controllerMeta,
        controllerClass: instance.constructor
    };
    (handler as any)._raitonContract = contract;

    return handler;
}
