import {MiddlewareCallable, ParamMetaInterface, RouteMetaInterface} from "../../types";
import {middlewareCompose} from "../../core";
import {validate} from "class-validator";
import {parseCookie} from "@/framework/utilities/cookie.util";
import {DataTransferObject, METADATA_KEYS, Parametrable, Throwable, ViewModel} from "@/framework";

/**
 * Helper function for collecting arguments from route parameters
 * @param instance
 * @param routeMeta
 * @param ctx
 */
export function collectRouteArguments(instance: any, routeMeta: RouteMetaInterface, ctx: any): any[] {
    const args: any[] = [];
    const params: ParamMetaInterface[] = Reflect.getMetadata(METADATA_KEYS.ROUTE_PARAMETERS, instance.constructor)?.[routeMeta.propertyKey] || [];

    for (const p of params) {
        switch (p.type) {
            case Parametrable.QUERY:
                args[p.index] = ctx.req.query?.[p.key!]
                break;
            case Parametrable.PARAM:
                args[p.index] = ctx.req.params?.[p.key!] ?? ctx.params?.[p.key!]
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

/**
 *
 * @param responses
 * @param instance
 * @param routeMeta
 */
export async function validateResponse(responses: any, instance: any, routeMeta: RouteMetaInterface): Promise<void> {
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

    // Validate response based on @ApiResponse metadata
    const apiResponses = Reflect.getMetadata(METADATA_KEYS.API_RESPONSES, instance.constructor)?.[routeMeta.propertyKey] || [];
    const successResponse = apiResponses.find((r: any) => r.status === 200) || apiResponses[0]; // Prefer 200, fallback to first

    if (successResponse && successResponse.type) {
        // If it's supposed to be an array, validate each element
        if (successResponse.isArray && Array.isArray(responses)) {
            for (const item of responses) {
                const validationTarget = typeof successResponse.type === 'function' && 'prototype' in successResponse.type
                    ? new successResponse.type(item)
                    : item;
                const errors = await validate(validationTarget);
                if (errors.length > 0) {
                    const errorMessages = errors.map(err =>
                        Object.values(err.constraints || {}).join(', ')
                    ).join('; ');
                    throw new Throwable(`Response validation failed: ${errorMessages}`, 500);
                }
            }
        } else {
            const validationTarget = typeof successResponse.type === 'function' && 'prototype' in successResponse.type
                ? new successResponse.type(responses)
                : responses;
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

// Helper function for running middlewares
export async function runMiddlewares(middlewares: MiddlewareCallable[], ctx: any): Promise<void> {
    if (middlewares.length > 0) {
        await middlewareCompose(middlewares)(ctx);
    }
}