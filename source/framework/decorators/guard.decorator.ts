import type {GuardOptions} from "../../types/guard.ts";
import {Middleware} from "./middleware.decorator.ts";
import {RaitonGuards} from "../../core/guards.ts";
import {HttpStatus} from "../enums/http-status.enum.ts";
import {RaitonResponses} from "../responses/helpers.ts";

export function createGuardDecoration({name, handler}: GuardOptions) {
    return Middleware(async ({next, context}) => {
        const guard = RaitonGuards.get(name);

        if (!guard) RaitonGuards.set(name, {name, handler, enabled: true})
        if (guard && !guard.enabled) return next();

        const response = await handler({context, next})

        if (response) return next()

        context.reply.status(HttpStatus.FORBIDDEN)
        return         context.reply.send(RaitonResponses('Forbidden', null, HttpStatus.FORBIDDEN, {error: true}));
    });
}