import {RuntimeAdapter, RuntimeReply, RuntimeRequest} from '@/types'

export const webRuntime: RuntimeAdapter = {
    createServer(handler) {
        async function fetching(request: Request, handler: (req: RuntimeRequest, reply: RuntimeReply) => Promise<void>): Promise<Response> {
            let responseBody: any
            let statusCode = 200
            const headers = new Headers()

            const runtimeReq: RuntimeRequest = {
                method: request.method,
                url: request.url,
                headers: request.headers,
                body: request.body as any
            }

            const runtimeReply: RuntimeReply = {
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

            await handler(runtimeReq, runtimeReply)

            return new Response(
                typeof responseBody === 'object' && !(responseBody instanceof Uint8Array)
                    ? JSON.stringify(responseBody)
                    : responseBody,
                {status: statusCode, headers}
            )
        }

        return {
            async listen() {
                console.warn('Web runtime does not support listening')
            },
            async close() {
                console.warn('Web runtime does not support closing')
            },
            async handle(request: Request) {
                return fetching(request, handler)
            }
        }
    }
}
