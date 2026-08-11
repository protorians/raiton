import {definePlugin} from "../../../core/plugins";
import {ContextInterface, MiddlewareParametersInterface, MiddlewareNextCallable} from "../../../types";
import {RaitonResponses, HttpStatus} from "../..";


export const secureMethodGuard = (allowed: string[]) =>
  definePlugin((scope) => {
    scope.use(async ({context, next}: MiddlewareParametersInterface) => {
      if (!allowed.includes(context.req.method)) {
        return context.send(RaitonResponses('Method not allowed', null, HttpStatus.METHOD_NOT_ALLOWED, {error: true}))
      }
      await next()
    })
  }, 'method-guard')
