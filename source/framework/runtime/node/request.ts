import { IncomingMessage } from 'node:http'
import type { RuntimeRequestInterface } from '../../../types'
import {getRealIp} from "../../utilities";

export class NodeRequest implements RuntimeRequestInterface {
    constructor(public req: IncomingMessage) {
        // copy or wrap
    }

    get method(): string {
        return this.req.method ?? 'GET'
    }

    get url(): string {
        return this.req.url ?? '/'
    }

    get headers(): Headers {
        return new Headers(this.req.headers as Record<string, string>)
    }

    get body(): any {
        // In Node, the request body is a stream; we leave it as the request object itself for simplicity
        return this.req
    }

    get query(): Record<string, any> | undefined {
        // Not implemented; middleware can parse query string from url
        return undefined
    }

    get params(): Record<string, any> | undefined {
        // Not implemented; route params filled by router
        return undefined
    }

    get file(): any {
        return undefined
    }

    get files(): any {
        return undefined
    }

    get remoteAddress(): string | undefined {
        return this.req.socket?.remoteAddress
    }

    get ip(): string | undefined {
        return getRealIp(this.headers, this.remoteAddress)
    }
}