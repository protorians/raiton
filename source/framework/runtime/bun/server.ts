import {RuntimeAdapterInterface} from '../../../types'
import {Logger} from "@protorians/logger";
import {getRealIp} from "../../utilities";

export const bunRuntime: RuntimeAdapterInterface = {
    createServer(handler) {
        if (typeof Bun === 'undefined') throw new Error(
            'bun is not installed, please run `npm install bun`'
        )

        let server: any

        return {
            async listen(port, hostname) {
                server = Bun.serve({
                    port,
                    hostname,
                    fetch: async (request: Request, server: any) => {
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
                })
            },
            async close() {
                server?.stop()
            }
        }
    }
}