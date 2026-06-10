import {GuardOptions} from "../../types";
import {Middleware} from "./middleware.decorator";
import {RaitonGuards} from "../../core/guards";
import {HttpStatus} from "../enums";

export function createGuardDecoration({name, handler}: GuardOptions) {
    return Middleware(async ({next, context}) => {
        const guard = RaitonGuards.get(name);

        if (!guard) RaitonGuards.set(name, {name, handler, enabled: true})
        if (guard && !guard.enabled) return next();

        const response = await handler({context, next})

        if (response) return next()

        context.reply.status(HttpStatus.FORBIDDEN)
        return context.reply.send({
            error: true,
            message: 'Forbidden'
        });
    });
}