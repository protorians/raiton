import {definePlugin} from "../../../core/plugins";
import {MiddlewareParametersInterface} from "../../../types";
import {Logger} from "@protorians/logger";

export interface CorsOptions {
    origin?: string | string[] | boolean | ((origin: string) => boolean | Promise<boolean>)
    methods?: string[]
    headers?: string[]
    credentials?: boolean
    maxAge?: number
    exposeHeaders?: string[]
}

export const secureCors = (opts: CorsOptions = {}) => {

    return (async ({context, next}: MiddlewareParametersInterface) => {
        const origin = context.req.headers.get('origin')

        if (origin) {
            context.reply.header('Vary', 'Origin')
        }

        let allowedOrigin: string | null = null

        if (opts.origin === undefined || opts.origin === '*') {
            allowedOrigin = '*'
        } else if (opts.origin === true) {
            allowedOrigin = origin || '*'
        } else if (typeof opts.origin === 'function') {
            if (origin && await opts.origin(origin)) {
                allowedOrigin = origin
            }
        } else if (Array.isArray(opts.origin)) {
            if (origin && opts.origin.includes(origin)) {
                allowedOrigin = origin
            }
        } else if (typeof opts.origin === 'string') {
            if (opts.origin === origin) {
                allowedOrigin = origin
            } else if (opts.origin === '*') {
                allowedOrigin = '*'
            }
        }

        if (allowedOrigin) {
            context.reply.header('Access-Control-Allow-Origin', allowedOrigin)
        }

        if (opts.credentials) {
            context.reply.header('Access-Control-Allow-Credentials', 'true')
        }

        if (opts.exposeHeaders) {
            context.reply.header('Access-Control-Expose-Headers', opts.exposeHeaders.join(','))
        }

        if (context.req.method === 'OPTIONS') {
            context.reply.header(
                'Access-Control-Allow-Methods',
                (opts.methods ?? ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).join(',')
            )

            context.reply.header(
                'Access-Control-Allow-Headers',
                (opts.headers ?? ['Content-Type', 'Authorization', 'X-Requested-With']).join(',')
            )

            if (opts.maxAge) {
                context.reply.header('Access-Control-Max-Age', opts.maxAge.toString())
            }

            context.reply.status(204)
            return context.send(null)
        }

        await next()
    })
}
