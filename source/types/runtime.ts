import {RuntimeType} from "@/sdk/enums/runtime.enum";

export interface RuntimeServer {
    listen(port: number): Promise<void>

    close(): Promise<void>

    handle?(request: Request): Promise<Response>
}

export interface RuntimeRequest {
    method: string
    url: string
    headers: Headers
    body?: ReadableStream<Uint8Array> | Uint8Array | null
    remoteAddress?: string
}

export type RuntimeHandlerCallable = (req: RuntimeRequest, reply: RuntimeReply) => Promise<void>

export interface RuntimeReply {
    status(code: number): void

    header(name: string, value: string): void

    send(body: any): void

    text(text: string | Buffer): void

    json(data: any): void
}

export interface RuntimeAdapter {
    createServer(handler: RuntimeHandlerCallable): RuntimeServer
}


export interface RuntimeInterface {
    readonly type: RuntimeType;
    get isNode(): boolean;
    get isDeno(): boolean;
    get isWeb(): boolean;
    get isBun(): boolean
    adapter(): RuntimeAdapter;
    createServer(handler: RuntimeHandlerCallable): RuntimeServer;
}