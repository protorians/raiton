import {definePlugin} from "../../../core/plugins/index.ts";
import {MiddlewareParametersInterface} from "../../../types/index.ts";
import {RaitonResponses, HttpStatus} from "../../index.ts";


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
