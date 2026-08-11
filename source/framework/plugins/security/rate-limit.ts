import {definePlugin} from "../../../core/plugins";
import {ContextInterface, MiddlewareParametersInterface, MiddlewareNextCallable} from "../../../types";
import {RaitonResponses, HttpStatus} from "../..";


export interface RateLimitOptions {
    windowMs?: number
    max?: number
}

export const secureRateLimit = (
    opts: RateLimitOptions = {}
) =>
    definePlugin((scope) => {
        const hits = new Map<string, { count: number; ts: number }>()

        const windowMs = opts.windowMs ?? 60_000
        const max = opts.max ?? 100

        scope.use(async ({context, next}: MiddlewareParametersInterface) => {
            const ip =
                context.req.remoteAddress ?? 'unknown'
            const now = Date.now()

            const entry = hits.get(ip) ?? {count: 0, ts: now}

            if (now - entry.ts > windowMs) {
                entry.count = 0
                entry.ts = now
            }

            entry.count++

            hits.set(ip, entry)

            if (entry.count > max) {
                return context.send(RaitonResponses('Too many requests', null, HttpStatus.TOO_MANY_REQUESTS, {error: true}))
            }

            await next()
        })
    }, 'rate-limit')
