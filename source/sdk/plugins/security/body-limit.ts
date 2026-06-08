import {definePlugin} from "../../../core/plugins";
import {MiddlewareParametersInterface} from "../../../types";


export const secureBodyLimit = (maxBytes = 1_000_000) =>
  definePlugin((scope) => {
    scope.use(async ({context, next}: MiddlewareParametersInterface) => {
      const len = Number(
        context.req.headers.get('content-length') ?? 0
      )

      if (len > maxBytes) {
        context.reply.status(413)
        return context.send({ error: 'Payload too large' })
      }

      await next()
    })
  }, 'body-limit')
