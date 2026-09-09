import {GuardOptions} from "../../types/index.ts";
import {Middleware} from "./middleware.decorator.ts";
import {RaitonGuards} from "../../core/guards.ts";
import {HttpStatus, RaitonResponses} from "../index.ts";

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