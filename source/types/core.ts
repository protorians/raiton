import type {
    RuntimeRequestInterface,
    RuntimeReplyInterface
} from './runtime'

export type HookNameType =
    | 'onRequest'
    | 'preParsing'
    | 'preHandler'
    | 'onSend'
    | 'onResponse'

export type HookHandlerCallable = (ctx: ContextInterface) => Promise<void> | void

export interface ContextInterface {
    req: RuntimeRequestInterface
    reply: RuntimeReplyInterface

    state: Record<string, any>

    decorate<T = any>(key: string, value: T): void

    get<T = any>(key: string): T

    send(body: any): void
}
