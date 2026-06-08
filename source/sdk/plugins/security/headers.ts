import {definePlugin} from "../../../core/plugins";
import {Context, MiddlewareParameters, NextCallable} from "../../../types";


export const secureHeaders = definePlugin((scope) => {
  scope.use(async ({context, next}: MiddlewareParameters) => {
    context.reply.header('X-Content-Type-Options', 'nosniff')
    context.reply.header('X-Frame-Options', 'DENY')
    context.reply.header('Referrer-Policy', 'no-referrer')
    context.reply.header('X-XSS-Protection', '1; mode=block')

    await next()
  })
}, 'security-headers')
