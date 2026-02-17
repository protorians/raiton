import {RuntimeType} from "@/sdk/enums/runtime.enum";

export interface RuntimeServerInterface {
    listen(port: number, hostname?: string): Promise<void>

    close(): Promise<void>

    handle?(request: Request): Promise<Response>
}

export interface RuntimeRequestInterface {
    method: string
    url: string
    headers: Headers
    body?: ReadableStream<Uint8Array> | Uint8Array | Record<string, any> | null;
    query?: Record<string, any>
    remoteAddress?: string
}

export type RuntimeHandlerCallable = (req: RuntimeRequestInterface, reply: RuntimeReplyInterface) => Promise<void>

export interface RuntimeReplyInterface {
    status(code: number): void

    header(name: string, value: string): void

    send(body: any): void

    text(text: string | Buffer): void

    json(data: any): void
}

export interface RuntimeAdapterInterface {
    createServer(handler: RuntimeHandlerCallable): RuntimeServerInterface
}


export interface RuntimeInterface {
    readonly type: RuntimeType;

    get isNode(): boolean;

    get isDeno(): boolean;

    get isWeb(): boolean;

    get isBun(): boolean

    adapter(): RuntimeAdapterInterface;

    createServer(handler: RuntimeHandlerCallable): RuntimeServerInterface;
}