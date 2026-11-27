import type {MiddlewareCallable, ParamMetaInterface, RouteMetaInterface} from "../../types/index.ts";
import {middlewareCompose} from "../middleware/compose.ts";
import {DataTransferObject} from "../../framework/data-transfer-object.ts";
import {METADATA_KEYS} from "../../framework/constants/decorators.constant.ts";
import {Parametrable} from "../../framework/enums/http-parameters.enum.ts";
import {parseCookie} from "../../framework/utilities/cookie.util.ts";
import {Throwable} from "../../framework/exceptions/throwable.ts";
import {ViewModel} from "../../framework/view-model.ts";
import {loadClassValidator} from "../../framework/utilities/validation.util.ts";

/**
 * Récupère (une seule fois, à la compilation du handler) les métadonnées de
 * paramètres d'une route.
 */
export function getRouteParameters(instance: any, routeMeta: RouteMetaInterface): ParamMetaInterface[] {
    return Reflect.getMetadata(METADATA_KEYS.ROUTE_PARAMETERS, instance.constructor)?.[routeMeta.propertyKey] || []
}

/**
 * Collecte les arguments d'un handler à partir de métadonnées déjà résolues.
 *
 * Cette fonction ne fait aucune réflexion : elle est appelée à chaque requête
 * avec le tableau figé au moment de la compilation du handler.
 */
export function collectArguments(params: readonly ParamMetaInterface[], ctx: any): any[] {
    const args: any[] = [];

    for (const p of params) {
        switch (p.type) {
            case Parametrable.QUERY:
                args[p.index] = ctx.req.query?.[p.key!]
                break;
            case Parametrable.PARAM:
                args[p.index] = ctx.params?.[p.key!] ?? ctx.req.params?.[p.key!]
                break;
            case Parametrable.BODY:
                if (p.metatype && 'prototype' in p.metatype) {
                    ctx.req.body = new p.metatype(ctx.req.body)
                }
                args[p.index] = ctx.req.body
                break;
            case Parametrable.HEADER:
                args[p.index] = ctx.req.headers[p.key!.toLowerCase()] as any;
                break;
            case Parametrable.COOKIE:
                const cookieHeader = ctx.req.headers.get('cookie');
                const cookies = parseCookie(cookieHeader);
                args[p.index] = p.key ? cookies[p.key!] : cookies;
                break;
            case Parametrable.REQ:
                args[p.index] = ctx.req
                break;
            case Parametrable.REPLY:
                args[p.index] = ctx.REPLY
                break;
            case Parametrable.UPLOAD_FILE:
                args[p.index] = ctx.req.file || ctx.req.files?.[p.key!]
                break;
            case Parametrable.CUSTOM:
                args[p.index] = p.callable?.(ctx) ?? null;
                break;
        }
    }

    return args;
}

/**
 * Compatibilité : récupère les métadonnées puis collecte les arguments.
 */
export function collectRouteArguments(instance: any, routeMeta: RouteMetaInterface, ctx: any): any[] {
    return collectArguments(getRouteParameters(instance, routeMeta), ctx);
}

/**
 * Helper function for validating DTO arguments
 * @param args
 */
export async function validateDtoArguments(args: any[]): Promise<void> {
    for (const input of args) {
        if (input instanceof DataTransferObject) {
            const errors = await input.validation(false);
            if (errors && errors.length) {
                const stack = Object.values(errors[0].constraints || {});
                throw new Throwable(stack.join(';'), 500);
            }
        }
    }
}

export type ResponseValidator = (responses: any) => Promise<void>

/**
 * Compile le validateur de réponse d'une route : métadonnées, cible et mode
 * tableau sont résolus une fois. Le validateur n'est créé par `createHandler`
 * que si la validation est active (dev/HMR ou configuration explicite).
 */
export function createResponseValidator(instance: any, routeMeta: RouteMetaInterface): ResponseValidator {
    // @ApiResponse() stores metadata on the class prototype.
    const holder = instance.constructor?.prototype ?? instance.constructor
    const apiResponses = Reflect.getMetadata(METADATA_KEYS.API_RESPONSES, holder)
        ?? Reflect.getMetadata(METADATA_KEYS.API_RESPONSES, instance.constructor)
        ?? [];
    const responses = apiResponses[routeMeta.propertyKey] || [];
    const successResponse = responses.find((r: any) => r.status === 200) || responses[0];
    const validationType = successResponse?.type;
    const isArray = Boolean(successResponse?.isArray);

    return async (responses: any) => {
        const {validate} = await loadClassValidator()

        // Special handling for ViewModel response wrapping: { data: viewModelInstance }
        if (responses && typeof responses === 'object' && 'data' in responses) {
            const data = (responses as any).data;
            if (data instanceof ViewModel) {
                const ViewModelClass = data.constructor as new (init: any) => ViewModel;
                const validationTarget = new ViewModelClass(data['__initial__']);
                const errors = await validate(validationTarget);
                if (errors.length > 0) {
                    const errorMessages = errors.map(err =>
                        Object.values(err.constraints || {}).join(', ')
                    ).join('; ');
                    throw new Throwable(`Response validation failed: ${errorMessages}`, 500);
                }
            }
        }

        if (validationType) {
            const buildTarget = (payload: any) => {
                if (typeof validationType === 'function' && 'prototype' in validationType) {
                    const target = new validationType(payload)
                    // Plain decorated classes often have no constructor that
                    // copies the payload; assign own fields as a fallback.
                    if (payload && typeof payload === 'object') {
                        for (const [key, value] of Object.entries(payload)) {
                            if (!(key in target) || target[key] === undefined) {
                                try {
                                    target[key] = value
                                } catch {
                                    // Read-only property: keep the constructor's value.
                                }
                            }
                        }
                    }
                    return target
                }
                return payload
            }

            if (isArray && Array.isArray(responses)) {
                for (const item of responses) {
                    const validationTarget = buildTarget(item);
                    const errors = await validate(validationTarget);
                    if (errors.length > 0) {
                        const errorMessages = errors.map(err =>
                            Object.values(err.constraints || {}).join(', ')
                        ).join('; ');
                        throw new Throwable(`Response validation failed: ${errorMessages}`, 500);
                    }
                }
            } else {
                const validationTarget = buildTarget(responses);
                const errors = await validate(validationTarget);
                if (errors.length > 0) {
                    const errorMessages = errors.map(err =>
                        Object.values(err.constraints || {}).join(', ')
                    ).join('; ');
                    throw new Throwable(`Response validation failed: ${errorMessages}`, 500);
                }
            }
        }
    }
}

/**
 * Compatibilité : compile puis exécute le validateur de réponse.
 *
 * @deprecated Utilisez `createResponseValidator()` à la compilation du handler
 * pour éviter de relire les métadonnées à chaque requête.
 */
export async function validateResponse(responses: any, instance: any, routeMeta: RouteMetaInterface): Promise<void> {
    await createResponseValidator(instance, routeMeta)(responses)
}

// Helper function for running middlewares
export async function runMiddlewares(middlewares: MiddlewareCallable[], ctx: any): Promise<void> {
    if (middlewares.length > 0) {
        await middlewareCompose(middlewares)(ctx);
    }
}
