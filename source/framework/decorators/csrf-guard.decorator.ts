import {MiddlewareParametersInterface, CsrfGuardOptions} from "../../types";
import {Middleware} from "./middleware.decorator";
import {HttpStatus, RaitonResponses} from "..";
import {CsrfUtil} from "../utilities/csrf.util";

const DEFAULT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
const DEFAULT_HEADER_NAME = 'X-CSRF-Token'
const DEFAULT_COOKIE_NAME = '_csrf'

export function CsrfGuard(options: CsrfGuardOptions = {}) {
    return Middleware(async ({context, next}: MiddlewareParametersInterface) => {
        const method = (context.req.method ?? '').toUpperCase()
        const methods = (options.methods ?? DEFAULT_METHODS).map(m => m.toUpperCase())

        if (!methods.includes(method)) {
            return next()
        }

        if (options.skipPaths) {
            const requestPath = new URL(context.req.url, 'http://localhost').pathname
            if (options.skipPaths.some(p => requestPath.startsWith(p))) {
                return next()
            }
        }

        const headerToken = context.req.headers.get(DEFAULT_HEADER_NAME.toLowerCase())
        const cookieHeader = context.req.headers.get('cookie') ?? ''
        const cookieToken = CsrfUtil.extractCookieValue(cookieHeader, DEFAULT_COOKIE_NAME)

        if (!headerToken || !cookieToken) {
            context.reply.status(HttpStatus.FORBIDDEN)
            return context.reply.send(
                RaitonResponses(
                    'CSRF token missing',
                    null,
                    HttpStatus.FORBIDDEN,
                    {error: true}
                )
            )
        }

        const valid = CsrfUtil.timingSafeEqual(cookieToken, headerToken)
        if (!valid) {
            context.reply.status(HttpStatus.FORBIDDEN)
            return context.reply.send(
                RaitonResponses(
                    'CSRF token mismatch',
                    null,
                    HttpStatus.FORBIDDEN,
                    {error: true}
                )
            )
        }

        context.state = context.state ?? {}
        context.state.csrfValidated = true

        await next()
    })
}
