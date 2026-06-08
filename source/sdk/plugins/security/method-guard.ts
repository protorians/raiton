import {definePlugin} from "../../../core/plugins";
import {Context, MiddlewareParameters, NextCallable} from "../../../types";


export const secureMethodGuard = (allowed: string[]) =>
  definePlugin((scope) => {
    scope.use(async ({context, next}: MiddlewareParameters) => {
      if (!allowed.includes(context.req.method)) {
        context.reply.status(405)
        return context.send({ error: 'Method not allowed' })
      }
      await next()
    })
  }, 'method-guard')
