import crypto from "node:crypto";
import {MiddlewareParametersInterface, CsrfGuardOptions} from "../../types";
import {Middleware} from "./middleware.decorator";
import {HttpStatus, RaitonResponses} from "..";

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
        const cookieToken = extractCookieValue(cookieHeader, DEFAULT_COOKIE_NAME)

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

        const valid = timingSafeEqual(cookieToken, headerToken)
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

function extractCookieValue(cookieHeader: string, name: string): string | undefined {
    const cookies = cookieHeader.split(';')
    for (const cookie of cookies) {
        const [key, ...valueParts] = cookie.trim().split('=')
        if (key === name) {
            return valueParts.join('=')
        }
    }
    return undefined
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    return crypto.timingSafeEqual(bufA, bufB)
}
