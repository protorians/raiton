import {definePlugin} from "@/core/plugins";
import {Context, Next} from "@/types";

export interface CorsOptions {
    origin?: string | string[]
    methods?: string[]
    headers?: string[]
}

export const secureCors = (opts: CorsOptions = {}) =>
    definePlugin((scope) => {
        scope.use(async (ctx: Context, next: Next) => {
            const origin = ctx.req.headers.get('origin')

            if (opts.origin) {
                const allowed = Array.isArray(opts.origin)
                    ? opts.origin.includes(origin!)
                    : opts.origin === origin

                if (allowed) {
                    ctx.reply.header('Access-Control-Allow-Origin', origin!)
                }
            } else {
                ctx.reply.header('Access-Control-Allow-Origin', '*')
            }

            ctx.reply.header(
                'Access-Control-Allow-Methods',
                (opts.methods ?? ['GET', 'POST', 'PUT', 'DELETE']).join(',')
            )

            ctx.reply.header(
                'Access-Control-Allow-Headers',
                (opts.headers ?? ['Content-Type', 'Authorization']).join(',')
            )

            if (ctx.req.method === 'OPTIONS') {
                ctx.reply.status(204)
                return ctx.send(null)
            }

            await next()
        })
    }, 'cors')
