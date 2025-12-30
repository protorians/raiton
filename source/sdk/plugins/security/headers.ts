import {definePlugin} from "@/core/plugins";
import {Context, Next} from "@/types";


export const secureHeaders = definePlugin((scope) => {
  scope.use(async (ctx: Context, next: Next) => {
    ctx.reply.header('X-Content-Type-Options', 'nosniff')
    ctx.reply.header('X-Frame-Options', 'DENY')
    ctx.reply.header('Referrer-Policy', 'no-referrer')
    ctx.reply.header('X-XSS-Protection', '1; mode=block')

    await next()
  })
}, 'security-headers')
