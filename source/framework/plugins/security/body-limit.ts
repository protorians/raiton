import {definePlugin} from "../../../core/plugins";
import {MiddlewareParametersInterface} from "../../../types";
import {RaitonResponses, HttpStatus} from "../..";


export const secureBodyLimit = (maxBytes = 1_000_000) =>
  definePlugin((scope) => {
    scope.use(async ({context, next}: MiddlewareParametersInterface) => {
      const len = Number(
        context.req.headers.get('content-length') ?? 0
      )

      if (len > maxBytes) {
        return context.send(RaitonResponses('Payload too large', null, HttpStatus.PAYLOAD_TOO_LARGE, {error: true}))
      }

      await next()
    })
  }, 'body-limit')
