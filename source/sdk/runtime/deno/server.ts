import {RuntimeAdapterInterface} from '../../../types'

export const denoRuntime: RuntimeAdapterInterface = {
    createServer(handler) {
        let controller: AbortController

        return {
            async listen(port, hostname) {
                if (typeof Deno === 'undefined') throw new Error(
                    'Deno is not installed, please run `deno install -A -f --unstable https://deno.land/x/raiton/cli.ts`'
                )

                controller = new AbortController()
                Deno.serve({port, hostname, signal: controller.signal}, async (req: any) => {
                    let body: any
                    let status = 200
                    const headers = new Headers()

                    await handler(
                        {
                            method: req.method,
                            url: req.url,
                            headers: req.headers,
                            body: req.body
                        },
                        {
                            status(code) {
                                status = code
                            },
                            header(name, value) {
                                headers.set(name, value)
                            },
                            send(value: any) {
                                body = value
                            },
                            text(text: string | Buffer) {
                                body = text
                            },
                            json(json: any) {
                                body = JSON.stringify(json)
                            },
                        }
                    )

                    return new Response(body, {status, headers})
                })
            },
            async close() {
                controller.abort()
            }
        }
    }
}
