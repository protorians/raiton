import {definePlugin} from "../../../core/plugins/index.ts";
import {ContextInterface, MiddlewareParametersInterface, MiddlewareNextCallable} from "../../../types/index.ts";
import {RaitonResponses, HttpStatus} from "../../index.ts";


export const secureMethodGuard = (allowed: string[]) =>
  definePlugin((scope) => {
    scope.use(async ({context, next}: MiddlewareParametersInterface) => {
      if (!allowed.includes(context.req.method)) {
        return context.send(RaitonResponses('Method not allowed', null, HttpStatus.METHOD_NOT_ALLOWED, {error: true}))
      }
      await next()
    })
  }, 'method-guard')
