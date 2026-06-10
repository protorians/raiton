import {definePlugin} from "../../../core/plugins";
import {ContextInterface, MiddlewareParametersInterface, MiddlewareNextCallable} from "../../../types";


export const secureMethodGuard = (allowed: string[]) =>
  definePlugin((scope) => {
    scope.use(async ({context, next}: MiddlewareParametersInterface) => {
      if (!allowed.includes(context.req.method)) {
        context.reply.status(405)
        return context.send({ error: 'Method not allowed' })
      }
      await next()
    })
  }, 'method-guard')
