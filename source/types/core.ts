import type {
    RuntimeRequestInterface,
    RuntimeReplyInterface
} from './runtime'

export type HookName =
    | 'onRequest'
    | 'preParsing'
    | 'preHandler'
    | 'onSend'
    | 'onResponse'

export type HookHandler = (
    ctx: Context
) => Promise<void> | void

export interface Context {
    req: RuntimeRequestInterface
    reply: RuntimeReplyInterface

    state: Record<string, any>

    decorate<T = any>(key: string, value: T): void

    get<T = any>(key: string): T

    send(body: any): void
}
