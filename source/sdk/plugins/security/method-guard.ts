import {definePlugin} from "@/core/plugins";
import {Context, Next} from "@/types";


export const secureMethodGuard = (allowed: string[]) =>
  definePlugin((scope) => {
    scope.use(async (ctx: Context, next: Next) => {
      if (!allowed.includes(ctx.req.method)) {
        ctx.reply.status(405)
        return ctx.send({ error: 'Method not allowed' })
      }
      await next()
    })
  }, 'method-guard')
