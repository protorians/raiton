import {
    RuntimeAdapterInterface,
    RuntimeServerOptionsInterface,
} from '../../../types'
import {Logger} from "@protorians/logger";
import {getRealIp} from "../../utilities";
import {findSocketForPath} from "../../../core/socket";
import {Injection} from "../../../core/injection";
import {RaitonResponses, HttpStatus} from "../..";

export const bunRuntime: RuntimeAdapterInterface = {
    createServer(handler, options?: RuntimeServerOptionsInterface) {
        if (typeof Bun === 'undefined') throw new Error(
            'bun is not installed, please run `npm install bun`'
        )

        let server: any

        const socketHandlers = {
            async open(ws: any) {
                try {
                    const entry = ws.data?.socketEntry
                    if (!entry) return

                    const instance: any = Injection.resolve(entry.construct)
                    if (!instance) return

                    ws.data.instance = instance

                    const connect = entry.metadata.events.find((event: any) => event.type === 'connect')
                    if (connect) await instance[connect.propertyKey]?.()
                } catch (e: any) {
                    Logger.error('Socket connect failed', e.message ?? e)
                    try { ws.close(1011, 'Internal error') } catch { /* noop */ }
                }
            },
            async message(ws: any, message: any) {
                try {
                    const instance = ws.data?.instance
                    if (!instance) return

                    let payload: any = message
                    if (typeof message === 'string') {
                        try { payload = JSON.parse(message) } catch { /* keep raw string */ }
                    }

                    const entry = ws.data.socketEntry
                    const eventName = payload && typeof payload === 'object' ? payload.event : undefined
                    const event = eventName
                        ? entry.metadata.events.find((item: any) => item.name === eventName && (item.type === 'event' || item.type === 'message'))
                        : entry.metadata.events.find((item: any) => item.type === 'message')

                    if (!event) {
                        ws.send(JSON.stringify(RaitonResponses(
                            `Socket event "${eventName ?? 'message'}" not found`,
                            null,
                            HttpStatus.NOT_FOUND
                        )))
                        return
                    }

                    const response = await instance[event.propertyKey]?.(payload?.data ?? payload)
                    if (response !== undefined) {
                        ws.send(JSON.stringify(response))
                    }
                } catch (e: any) {
                    Logger.error('Socket message failed', e.message ?? e)
                    ws.send(JSON.stringify(RaitonResponses(
                        'Internal server error',
                        null,
                        HttpStatus.INTERNAL_SERVER_ERROR
                    )))
                }
            },
            async close(ws: any) {
                try {
                    const instance = ws.data?.instance
                    if (!instance) return

                    const entry = ws.data.socketEntry
                    const disconnect = entry.metadata.events.find((event: any) => event.type === 'disconnect')
                    if (disconnect) await instance[disconnect.propertyKey]?.()
                } catch (e: any) {
                    Logger.error('Socket disconnect failed', e.message ?? e)
                }
            }
        }

        return {
            async listen(port, hostname) {
                const serveOptions: any = {
                    port,
                    hostname,
                    websocket: socketHandlers,
                    fetch: async (request: Request, server: any) => {
                        const upgrade = request.headers.get('upgrade')?.toLowerCase()

                        if (upgrade === 'websocket') {
                            const pathname = new URL(request.url).pathname
                            const socketEntry = findSocketForPath(pathname, options?.prefix)

                            if (socketEntry) {
                                if (server.upgrade(request, {
                                    data: {
                                        socketEntry,
                                        url: request.url,
                                        headers: request.headers
                                    }
                                })) {
                                    return undefined
                                }

                                return new Response('WebSocket upgrade failed', {status: 400})
                            }
                        }

                        let responseBody: any
                        let statusCode = 200
                        const headers = new Headers()

                        const remoteAddress = server.requestIP(request)?.address

                        await handler(
                            {
                                method: request.method,
                                url: request.url,
                                headers: request.headers as any,
                                body: request.body ? request.body : null,
                                remoteAddress,
                                ip: getRealIp(request.headers, remoteAddress)
                            },
                            {
                                status(code) {
                                    statusCode = code
                                },
                                header(name, value) {
                                    headers.set(name, value)
                                },
                                send(body: any) {
                                    if (body === undefined) {
                                        responseBody = ''
                                    } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
                                        responseBody = body;
                                    } else {
                                        headers.set('content-type', 'application/json');
                                        responseBody = (JSON.stringify(body));
                                    }
                                },
                                text(text: string | Buffer) {
                                    responseBody = text
                                },
                                json(json: any) {
                                    headers.set('content-type', 'application/json')
                                    responseBody = JSON.stringify(json)
                                },
                                type(contentType: string) {
                                    headers.set('content-type', contentType)
                                }
                            }
                        )

                        if (responseBody instanceof Response) {
                            return responseBody;
                        }

                        return new Response(
                            typeof responseBody === 'object' && !(responseBody instanceof Buffer)
                                ? JSON.stringify(responseBody)
                                : responseBody,
                            {status: statusCode, headers}
                        )
                    }
                }

                if (options?.https?.enabled && options.https.certificate) {
                    serveOptions.tls = {
                        cert: options.https.certificate.cert,
                        key: options.https.certificate.key,
                        ca: options.https.certificate.ca,
                        passphrase: options.https.certificate.passphrase,
                    }
                }

                server = Bun.serve(serveOptions)
            },
            async close() {
                server?.stop()
            }
        }
    }
}
