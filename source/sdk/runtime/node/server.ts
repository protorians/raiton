import http from 'node:http'
import {
    RuntimeAdapter,
    RuntimeRequest,
    RuntimeReply
} from '@/types'

export const nodeRuntime: RuntimeAdapter = {
    createServer(handler) {
        const server = http.createServer(async (req, res) => {
            const runtimeReq: RuntimeRequest = {
                method: req.method || 'GET',
                url: req.url || '/',
                headers: new Headers(req.headers as any),
                body: req as any,
                remoteAddress: req.socket.remoteAddress
            }

            const runtimeReply: RuntimeReply = {
                status(code) {
                    res.statusCode = code
                },
                header(name, value) {
                    res.setHeader(name, value)
                },
                send(body: any) {
                    if (body === undefined) {
                        res.end()
                    } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
                        res.end(body)
                    } else {
                        res.setHeader('content-type', 'application/json')
                        res.end(JSON.stringify(body))
                    }
                },
                text(text: string|Buffer) {
                    res.end(text)
                },
                json(json: any) {
                    res.end(JSON.stringify(json))
                },
            }

            await handler(runtimeReq, runtimeReply)
        })

        return {
            listen(port) {
                return new Promise((resolve) =>
                    server.listen(port, resolve)
                )
            },
            close() {
                return new Promise((resolve, reject) =>
                    server.close(err => err ? reject(err) : resolve())
                )
            }
        }
    }
}
