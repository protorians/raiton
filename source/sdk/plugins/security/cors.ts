import {definePlugin} from "@/core/plugins";
import {Context, MiddlewareParameters, NextCallable} from "@/types";

export interface CorsOptions {
    origin?: string | string[]
    methods?: string[]
    headers?: string[]
}

export const secureCors = (opts: CorsOptions = {}) =>
    definePlugin((scope) => {
        scope.use(async ({context, next}: MiddlewareParameters) => {
            const origin = context.req.headers.get('origin')

            if (opts.origin) {
                const allowed = Array.isArray(opts.origin)
                    ? opts.origin.includes(origin!)
                    : opts.origin === origin

                if (allowed) {
                    context.reply.header('Access-Control-Allow-Origin', origin!)
                }
            } else {
                context.reply.header('Access-Control-Allow-Origin', '*')
            }

            context.reply.header(
                'Access-Control-Allow-Methods',
                (opts.methods ?? ['GET', 'POST', 'PUT', 'DELETE']).join(',')
            )

            context.reply.header(
                'Access-Control-Allow-Headers',
                (opts.headers ?? ['Content-Type', 'Authorization']).join(',')
            )

            if (context.req.method === 'OPTIONS') {
                context.reply.status(204)
                return context.send(null)
            }

            await next()
        })
    }, 'cors')
