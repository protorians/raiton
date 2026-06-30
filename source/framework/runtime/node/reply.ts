import { ServerResponse } from 'node:http'
import type { RuntimeReplyInterface } from '../../../types'

export class NodeReply implements RuntimeReplyInterface {
    constructor(public res: ServerResponse) {}

    status(code: number): void {
        this.res.statusCode = code
    }

    header(name: string, value: string): void {
        this.res.setHeader(name, value)
    }

    send(body: any): void {
        if (body === undefined) {
            this.res.end()
        } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
            this.res.end(body)
        } else {
            this.res.setHeader('content-type', 'application/json')
            this.res.end(JSON.stringify(body))
        }
    }

    text(text: string | Buffer): void {
        this.res.end(text)
    }

    json(json: any): void {
        this.res.end(JSON.stringify(json))
    }

    type(contentType: string): void {
        this.res.setHeader('content-type', contentType)
    }
}