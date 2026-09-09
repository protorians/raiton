import {RuntimeAdapterInterface, RuntimeServerOptionsInterface} from '../../../types/index.ts'
import {Logger} from "@protorians/logger";
import {getRealIp} from "../../utilities/index.ts";
import {findSocketForPath} from "../../../core/socket/index.ts";
import {Injection} from "../../../core/injection/index.ts";
import {RaitonResponses, HttpStatus} from "../../index.ts";

export const denoRuntime: RuntimeAdapterInterface = {
    createServer(handler, options?: RuntimeServerOptionsInterface) {
        if (typeof Deno === 'undefined') throw new Error(
            'Deno is not available, please run this script with the Deno runtime (`deno run --allow-net ...`)'
        )

        let server: Deno.HttpServer | null = null

        const socketHandlers = {
            open(socket: WebSocket, entry: any) {
                try {
                    const instance: any = Injection.resolve(entry.construct)
                    if (!instance) return

                    socket.onmessage = async (event: MessageEvent) => {
                        try {
                            let payload: any = event.data
                            if (typeof payload === 'string') {
                                try { payload = JSON.parse(payload) } catch { /* keep raw string */ }
                            }

                            const eventName = payload && typeof payload === 'object' ? payload.event : undefined
                            const evt = eventName
                                ? entry.metadata.events.find((item: any) => item.name === eventName && (item.type === 'event' || item.type === 'message'))
                                : entry.metadata.events.find((item: any) => item.type === 'message')

                            if (!evt) {
                                socket.send(JSON.stringify(RaitonResponses(
                                    `Socket event "${eventName ?? 'message'}" not found`,
                                    null,
                                    HttpStatus.NOT_FOUND
                                )))
                                return
                            }

                            const response = await instance[evt.propertyKey]?.(payload?.data ?? payload)
                            if (response !== undefined) {
                                socket.send(JSON.stringify(response))
                            }
                        } catch (e: any) {
                            Logger.error('Socket message failed', e.message ?? e)
                            socket.send(JSON.stringify(RaitonResponses(
                                'Internal server error',
                                null,
                                HttpStatus.INTERNAL_SERVER_ERROR
                            )))
                        }
                    }

                    const connect = entry.metadata.events.find((event: any) => event.type === 'connect')
                    if (connect) instance[connect.propertyKey]?.()
                } catch (e: any) {
                    Logger.error('Socket connect failed', e.message ?? e)
                    try { socket.close(1011, 'Internal error') } catch { /* noop */ }
                }
            },
            close(socket: WebSocket, entry: any) {
                try {
                    const instance = (socket as any)._instance
                    if (!instance) return

                    const disconnect = entry.metadata.events.find((event: any) => event.type === 'disconnect')
                    if (disconnect) instance[disconnect.propertyKey]?.()
                } catch (e: any) {
                    Logger.error('Socket disconnect failed', e.message ?? e)
                }
            }
        }

        return {
            async listen(port, hostname) {
                server = Deno.serve(
                    {
                        port: Number(port),
                        hostname,
                        onListen() {
                            Logger.log('Deno server listening')
                        }
                    },
                    async (request, info) => {
                        const upgrade = request.headers.get('upgrade')?.toLowerCase()
                        const pathname = new URL(request.url).pathname

                        if (upgrade === 'websocket') {
                            const socketEntry = findSocketForPath(pathname, options?.prefix)
                            if (socketEntry) {
                                const {socket, response} = Deno.upgradeWebSocket(request)
                                const instance: any = Injection.resolve(socketEntry.construct)
                                ;(socket as any)._instance = instance
                                socket.onopen = () => socketHandlers.open(socket, socketEntry)
                                socket.onclose = () => socketHandlers.close(socket, socketEntry)
                                return response
                            }
                        }

                        let responseBody: any
                        let statusCode = 200
                        const headers = new Headers()

                        const remoteAddress = info.remoteAddr?.hostname

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
                                    } else if (typeof body === 'string' || body instanceof Uint8Array) {
                                        responseBody = body;
                                    } else {
                                        headers.set('content-type', 'application/json');
                                        responseBody = (JSON.stringify(body));
                                    }
                                },
                                text(text: string | Uint8Array) {
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
                            typeof responseBody === 'object' && !(responseBody instanceof Uint8Array)
                                ? JSON.stringify(responseBody)
                                : responseBody,
                            {status: statusCode, headers}
                        )
                    }
                )
            },
            async close() {
                await server?.shutdown()
            }
        }
    }
}