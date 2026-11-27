import {ControllerMetaInterface, RouteMetaInterface} from "../../types/index.ts";
import {Logger} from "@protorians/logger";
import {Raiton} from "../raiton.ts";
import {HttpException} from "../../framework/exceptions/http-exception.ts";
import {ThrowableResponse} from "../../framework/responses/http-throwable.ts";
import {
    collectArguments,
    createResponseValidator,
    getRouteParameters,
    validateDtoArguments,
    runMiddlewares,
} from "./handler.utils.ts";
import {RouteCache, getCacheMetadata} from "../../framework/cache/index.ts";
import {HttpStatus} from "../../framework/enums/http-status.enum.ts";
import {RaitonConfig} from "../config/index.ts";
import {
    ContractValidationError,
    getRouteContract,
    OutputContractError,
    validateRouteInput,
    validateRouteOutput,
} from "../../contracts/index.ts";
import {enrichErrorPayload, errorPayload, hintFor} from "../../framework/errors/catalog.ts";
import {getDebugCollector, getDebugRuntime, recordDebugLog} from "../../debug/runtime.ts";
import {resolveRouteSource, firstUserFrame, stackLines, relativeLocation} from "../../debug/source.ts";
import {toDebugIssues} from "../../debug/collector.ts";
import type {ContractIssue} from "../../contracts/index.ts";

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
    // Everything that does not depend on the request is resolved exactly once,
    // at handler compilation (including on every HMR recompile).
    const development = isDevelopment();
    const handlerName = `${instance.constructor.name}.${routeMeta.propertyKey}`
    const routeLabel = `${routeMeta.method} ${controllerMeta.prefix ?? ""}${routeMeta.path}`;
    const cacheOptions = getCacheMetadata(instance, routeMeta.propertyKey);
    const routeCache = cacheOptions
        ? new RouteCache(`${controllerMeta.prefix ?? ''}${routeMeta.path}`, cacheOptions)
        : undefined;
    const cacheEnabled = Boolean(routeCache?.enabled)
    const contract = getRouteContract(instance.constructor, routeMeta.propertyKey);
    const parameters = getRouteParameters(instance, routeMeta);
    const middlewares = [
        ...(controllerMeta.middlewares['@'] || []),
        ...(controllerMeta.middlewares[routeMeta.propertyKey] || []),
    ];
    const responseValidator = RaitonConfig.shouldValidateResponses(development)
        ? createResponseValidator(instance, routeMeta)
        : undefined;
    const source = resolveRouteSource(
        instance.constructor,
        controllerMeta,
        routeMeta,
        getDebugRuntime()?.workdir ?? process.cwd(),
    );
    const debugWorkdir = getDebugRuntime()?.workdir ?? process.cwd();
    const redactKeys = getDebugRuntime()?.config.journal.redact ?? [];

    const locationOf = (location?: string): string | undefined => {
        if (!development || !location) return undefined;
        return relativeLocation(location, debugWorkdir);
    };

    const journalIssues = (issues: ContractIssue[] | undefined, location?: string) => {
        if (!issues?.length) return [];
        return toDebugIssues(issues, redactKeys).map(issue => ({
            ...issue,
            ...(development && !issue.location && location ? {location: relativeLocation(location, debugWorkdir)} : {}),
        }));
    };

    const handler = async (ctx: any) => {
        const collector = ctx.state?.debug ? getDebugCollector() : undefined;
        if (collector) collector.setSource(ctx, source);

        try {
            const cacheKey = (cacheEnabled && routeCache!.matchesMethod(ctx.req?.method))
                ? await routeCache!.key(ctx)
                : undefined;

            if (cacheKey) {
                if (collector) {
                    const startedCache = performance.now();
                    const cached = await routeCache!.get(ctx, cacheKey);
                    if (cached) {
                        collector.step(ctx, "cache", "hit", performance.now() - startedCache);
                        collector.setCache(ctx, true);
                        ctx.reply.status(cached.status);
                        for (const [name, value] of Object.entries(cached.headers)) {
                            ctx.reply.header(name, value);
                        }
                        collector.step(ctx, "handler", "cached");
                        return cached.body;
                    }
                    collector.step(ctx, "cache", "miss", performance.now() - startedCache);
                    collector.setCache(ctx, false);
                } else {
                    const cached = await routeCache!.get(ctx, cacheKey);
                    if (cached) {
                        ctx.reply.status(cached.status);
                        for (const [name, value] of Object.entries(cached.headers)) {
                            ctx.reply.header(name, value);
                        }
                        return cached.body;
                    }
                }
            } else if (collector) {
                collector.step(ctx, "cache", cacheEnabled ? "skip" : "disabled");
            }

            if (collector) {
                const startedMiddlewares = performance.now();
                try {
                    await runMiddlewares(middlewares, ctx);
                    collector.step(ctx, "middleware", "ok", performance.now() - startedMiddlewares);
                } catch (error: any) {
                    collector.step(ctx, "middleware", "rejected", performance.now() - startedMiddlewares);
                    throw error;
                }
            } else {
                await runMiddlewares(middlewares, ctx);
            }

            // Schema-first input validation runs before the handler and before
            // DTO construction: an invalid payload never reaches user code.
            if (contract?.input) {
                const startedValidation = performance.now();
                const input = await validateRouteInput(contract, ctx);
                if (!input.success) {
                    if (collector) {
                        collector.setValidation(ctx, {
                            ok: false,
                            issues: journalIssues(input.issues, contract.inputLocation),
                        });
                        collector.step(ctx, "validation:input", "rejected", performance.now() - startedValidation);
                        collector.markHandler(ctx, false);
                        collector.step(ctx, "handler", "not-executed");
                    }
                    throw new ContractValidationError(input.issues);
                }
                if (collector) {
                    collector.setValidation(ctx, {ok: true, issues: []});
                    collector.step(ctx, "validation:input", "ok", performance.now() - startedValidation);
                }
                if (input.body !== undefined) ctx.req.body = input.body;
            } else if (collector) {
                collector.setValidation(ctx, {ok: true, absent: true, issues: []});
                collector.step(ctx, "validation:input", "absent");
            }

            const args = collectArguments(parameters, ctx);
            await validateDtoArguments(args);
            if (collector) collector.markHandler(ctx, true);
            const startedHandler = performance.now();
            let responses = instance[routeMeta.propertyKey](...args);
            if (responses instanceof Promise) responses = await responses;
            if (collector) collector.step(ctx, "handler", "ok", performance.now() - startedHandler);

            if (contract?.output && responseValidator) {
                const startedOutput = performance.now();
                const output = await validateRouteOutput(contract, responses);
                if (!output.success) {
                    if (collector) {
                        collector.step(ctx, "validation:output", "rejected", performance.now() - startedOutput);
                    }
                    Logger.error(
                        `[contract] ${routeLabel} returned an invalid response` +
                        (ctx.state?.requestId ? ` request_id=${ctx.state.requestId}` : '') +
                        `: ` + output.issues.map(issue => `${issue.path || "<root>"} (${issue.code})`).join(", ")
                    );
                    if (development) throw new OutputContractError(routeLabel, output.issues);
                } else if (collector) {
                    collector.step(ctx, "validation:output", "ok", performance.now() - startedOutput);
                }
            }

            if (responseValidator) await responseValidator(responses);

            if (cacheKey && !(responses instanceof ThrowableResponse)) {
                await routeCache!.set(ctx, responses, 200, {}, cacheKey);
            }

            return responses;
        } catch (err: any) {

            const requestId = ctx.state?.requestId
            Logger.info(`${ctx.req?.method} ${ctx.req?.url}${requestId ? ` request_id=${requestId}` : ''}`)

            if (err instanceof ContractValidationError || err instanceof OutputContractError) {
                Logger.warn(`[contract] ${routeLabel} rejected request${requestId ? ` request_id=${requestId}` : ''}`);
                const location = err instanceof OutputContractError
                    ? locationOf(contract?.outputLocation)
                    : locationOf(contract?.inputLocation);
                const issues = journalIssues(err.issues, location);
                if (collector) {
                    collector.setValidation(ctx, {
                        ok: false,
                        issues: err instanceof OutputContractError
                            ? journalIssues(err.issues, contract?.outputLocation)
                            : journalIssues(err.issues, contract?.inputLocation),
                    });
                    collector.setError(ctx, {
                        code: err instanceof OutputContractError ? "OUTPUT_VALIDATION_ERROR" : "VALIDATION_ERROR",
                        message: err.message,
                        statusCode: err.statusCode,
                        ...(development && err.stack ? {stack: stackLines(err)} : {}),
                        ...(location ? {location} : {}),
                    });
                }
                recordDebugLog("warn", `[contract] ${routeLabel} rejected request ${requestId ?? ""}`);
                ctx.reply.status(err.statusCode);
                return enrichErrorPayload(err.render({
                    requestId,
                    hint: err instanceof OutputContractError
                        ? `The handler ran but its response does not match the @Output contract of ${routeLabel}.`
                        : "The handler was not executed. Fix the listed fields and retry.",
                    location,
                    redact: redactKeys,
                    development,
                }), err.statusCode, requestId, {redact: redactKeys});
            }

            if (err instanceof HttpException || err instanceof ThrowableResponse) {
                Logger.error(`Failed to execute ${handlerName} handler${requestId ? ` request_id=${requestId}` : ''}`, err.message ?? err);
                const status = err.statusCode ?? 500;
                const location = development ? firstUserFrame(err.stack) : undefined;
                if (collector) {
                    collector.setError(ctx, {
                        code: typeof (err as any).code === "string" ? (err as any).code : "INTERNAL_SERVER_ERROR",
                        message: String(err.message ?? err),
                        statusCode: status,
                        ...(development ? {stack: stackLines(err)} : {}),
                        ...(location ? {location} : {}),
                    });
                    collector.step(ctx, "handler", "error", undefined, String(err.message ?? err));
                }
                recordDebugLog("error", `${handlerName}: ${err.message ?? err}`);
                ctx.reply.status(status)
                return enrichErrorPayload(err.render(), status, requestId, {
                    hint: hintFor("INTERNAL_SERVER_ERROR"),
                    location,
                    stack: development ? stackLines(err) : undefined,
                    redact: redactKeys,
                })
            }

            const location = development ? firstUserFrame(err?.stack) : undefined;
            if (collector) {
                collector.setError(ctx, {
                    code: "INTERNAL_SERVER_ERROR",
                    message: String(err?.message ?? err),
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    ...(development ? {stack: stackLines(err)} : {}),
                    ...(location ? {location} : {}),
                });
                collector.step(ctx, "handler", "error", undefined, String(err?.message ?? err));
            }
            recordDebugLog("error", `${handlerName}: ${err?.message ?? err}`);
            ctx.reply.status(HttpStatus.INTERNAL_SERVER_ERROR);
            return errorPayload("INTERNAL_SERVER_ERROR", {
                requestId,
                hint: hintFor("INTERNAL_SERVER_ERROR"),
                redact: redactKeys,
                ...(development ? {
                    details: {message: String(err?.message ?? err)},
                    location,
                    stack: stackLines(err),
                } : {}),
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
