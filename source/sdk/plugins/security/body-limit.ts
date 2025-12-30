import {definePlugin} from "@/core/plugins";
import {Context, Next} from "@/types";


export const secureBodyLimit = (maxBytes = 1_000_000) =>
  definePlugin((scope) => {
    scope.use(async (ctx: Context, next: Next) => {
      const len = Number(
        ctx.req.headers.get('content-length') ?? 0
      )

      if (len > maxBytes) {
        ctx.reply.status(413)
        return ctx.send({ error: 'Payload too large' })
      }

      await next()
    })
  }, 'body-limit')
