import {RuntimeAdapter} from '@/types'

export const bunRuntime: RuntimeAdapter = {
    createServer(handler) {
        if (typeof Bun === 'undefined') throw new Error(
            'bun is not installed, please run `npm install bun`'
        )

        const server = Bun.serve({
            fetch: async (request: any) => {
                let responseBody: any
                let statusCode = 200
                const headers = new Headers()

                await handler(
                    {
                        method: request.method,
                        url: request.url,
                        headers: request.headers,
                        body: request.body
                    },
                    {
                        status(code) {
                            statusCode = code
                        },
                        header(name, value) {
                            headers.set(name, value)
                        },
                        send(body) {
                            responseBody = body
                        },
                        text(text: string | Buffer) {
                            responseBody = text
                        },
                        json(json: any) {
                            responseBody = JSON.stringify(json)
                        },
                    }
                )

                return new Response(
                    typeof responseBody === 'object'
                        ? JSON.stringify(responseBody)
                        : responseBody,
                    {status: statusCode, headers}
                )
            }
        })

        return {
            async listen() {
            },
            async close() {
                server.stop()
            }
        }
    }
}
