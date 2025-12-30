import {definePlugin} from "@/core/plugins";
import {Context, Next} from "@/types";


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

    scope.use(async (ctx: Context, next: Next) => {
      const ip =
        ctx.req.remoteAddress ?? 'unknown'
      const now = Date.now()

      const entry = hits.get(ip) ?? { count: 0, ts: now }

      if (now - entry.ts > windowMs) {
        entry.count = 0
        entry.ts = now
      }

      entry.count++

      hits.set(ip, entry)

      if (entry.count > max) {
        ctx.reply.status(429)
        return ctx.send({ error: 'Too many requests' })
      }

      await next()
    })
  }, 'rate-limit')
