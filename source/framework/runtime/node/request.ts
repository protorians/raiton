import { IncomingMessage } from 'node:http'
import type { RuntimeRequestInterface } from '../../../types/index.ts'
import {getRealIp} from "../../utilities/ip.util.ts";

export class NodeRequest implements RuntimeRequestInterface {
    private _headers?: Headers
    private _body: any
    private _query?: Record<string, any>
    private _params?: Record<string, any>
    private _file: any
    private _files: any
    private _ip?: string

    constructor(public req: IncomingMessage) {
        // In Node, the request body is a stream until the body parser consumes it.
        this._body = req
    }

    get method(): string {
        return this.req.method ?? 'GET'
    }

    get url(): string {
        return this.req.url ?? '/'
    }

    /**
     * Node creates a `Headers` instance per access; memoise it per request so
     * content-type/cookie/accept lookups don't allocate repeatedly.
     */
    get headers(): Headers {
        if (!this._headers) {
            const headers = new Headers()
            for (const [name, value] of Object.entries(this.req.headers)) {
                if (value === undefined) continue
                if (Array.isArray(value)) {
                    for (const item of value) headers.append(name, String(item))
                } else {
                    headers.set(name, String(value))
                }
            }
            this._headers = headers
        }
        return this._headers
    }

    set headers(value: Headers) {
        this._headers = value
    }

    get body(): any {
        return this._body
    }

    set body(value: any) {
        this._body = value
    }

    get query(): Record<string, any> | undefined {
        return this._query
    }

    set query(value: Record<string, any> | undefined) {
        this._query = value
    }

    get params(): Record<string, any> | undefined {
        return this._params
    }

    set params(value: Record<string, any> | undefined) {
        this._params = value
    }

    get file(): any {
        return this._file
    }

    set file(value: any) {
        this._file = value
    }

    get files(): any {
        return this._files
    }

    set files(value: any) {
        this._files = value
    }

    get remoteAddress(): string | undefined {
        return this.req.socket?.remoteAddress
    }

    get ip(): string | undefined {
        return this._ip ??= getRealIp(this.headers, this.remoteAddress)
    }
}
