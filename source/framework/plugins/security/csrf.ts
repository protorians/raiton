import crypto from "node:crypto";
import {definePlugin} from "../../../core/plugins";
import {MiddlewareParametersInterface} from "../../../types";
import {RaitonResponses, HttpStatus} from "../..";
import {CsrfUtil} from "../../utilities/csrf.util";
import {CSRFModeEnum} from "../../enums";
import type {CsrfOptions, CsrfCookieOptions} from "../../../types";

const DEFAULT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
const DEFAULT_COOKIE_NAME = '_csrf'
const DEFAULT_HEADER_NAME = 'X-CSRF-Token'
const DEFAULT_TTL = 3600_000

export const secureCsrf = (opts: CsrfOptions = {}) => {

    return definePlugin((scope) => {
        const mode = opts.mode ?? CSRF_MODE_DEFAULT
        const secret = opts.secret ?? cryptoRandomSecret()
        const cookieName = opts.cookieName ?? DEFAULT_COOKIE_NAME
        const headerName = opts.headerName ?? DEFAULT_HEADER_NAME
        const ttl = opts.ttl ?? DEFAULT_TTL
        const methods = (opts.methods ?? DEFAULT_METHODS).map(m => m.toUpperCase())
        const skipPaths = opts.skipPaths ?? []
        const cookieOpts: CsrfCookieOptions = {
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
            path: '/',
            ...opts.cookieOptions,
        }

        const tokenStore = mode === CSRF_MODE_SYNCHRONIZER
            ? CsrfUtil.createTokenStore(ttl)
            : undefined

        const destroy = () => {
            tokenStore?.destroy()
        }

        scope.addHook('onResponse', async (ctx: any) => {
            if (ctx && typeof ctx === 'object' && 'reply' in ctx) {
                const method = (ctx.req?.method ?? '').toUpperCase()
                if (methods.includes(method)) {
                    const token = tokenStore
                        ? tokenStore.create()
                        : CsrfUtil.generateDoubleSubmitToken(secret)

                    ctx.state = ctx.state ?? {}
                    ctx.state.csrfToken = token

                    ctx.reply.header(
                        'Set-Cookie',
                        CsrfUtil.serializeCookie(cookieName, token, cookieOpts)
                    )
                }
            }
        })

        scope.use(async ({context, next}: MiddlewareParametersInterface) => {
            const method = (context.req.method ?? '').toUpperCase()

            if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
                const token = tokenStore
                    ? tokenStore.create()
                    : CsrfUtil.generateDoubleSubmitToken(secret)

                context.state = context.state ?? {}
                context.state.csrfToken = token

                context.reply.header(
                    'Set-Cookie',
                    CsrfUtil.serializeCookie(cookieName, token, cookieOpts)
                )

                return next()
            }

            if (!methods.includes(method)) {
                return next()
            }

            const requestPath = new URL(context.req.url, 'http://localhost').pathname
            if (skipPaths.some(p => requestPath.startsWith(p))) {
                return next()
            }

            const isBrowser = CsrfUtil.isBrowserClient(context.req.headers, opts.clientDetection)
            if (!isBrowser) {
                return next()
            }

            const cookieHeader = context.req.headers.get('cookie') ?? ''
            const cookieToken = CsrfUtil.extractCookieValue(cookieHeader, cookieName)
            const headerToken = context.req.headers.get(headerName.toLowerCase())

            if (!cookieToken || !headerToken) {
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

            let valid = false

            if (mode === CSRF_MODE_DOUBLE_SUBMIT) {
                valid = CsrfUtil.validateDoubleSubmitToken(secret, cookieToken, ttl)
                    && CsrfUtil.timingSafeEqual(cookieToken, headerToken)
            } else {
                const storeValid = tokenStore?.validate(cookieToken) ?? false
                valid = storeValid && CsrfUtil.timingSafeEqual(cookieToken, headerToken)
            }

            if (!valid) {
                context.reply.status(HttpStatus.FORBIDDEN)
                return context.reply.send(
                    RaitonResponses(
                        'CSRF token invalid',
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

    }, 'csrf')
}

function cryptoRandomSecret(): string {
    return crypto.randomBytes(32).toString('hex')
}

const CSRF_MODE_DEFAULT = CSRFModeEnum.DOUBLE_SUBMIT
const CSRF_MODE_SYNCHRONIZER = CSRFModeEnum.SYNCHRONIZER
const CSRF_MODE_DOUBLE_SUBMIT = CSRFModeEnum.DOUBLE_SUBMIT
