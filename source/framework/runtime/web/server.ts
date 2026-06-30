// import {RuntimeAdapterInterface} from '../../../types'
// import {Logger} from "@protorians/logger";
//
// export const webRuntime: RuntimeAdapterInterface = {
//     createServer(handler) {
//         let responseBody: any
//         let statusCode = 200
//         const headers = new Headers()
//
//         const fetching = async (request: Request, handler: any) => {
//             // Reset for each request
//             responseBody = undefined
//             statusCode = 200
//             // headers.clear()
//
//             await handler(
//                 {
//                     method: request.method,
//                     url: request.url,
//                     headers: request.headers,
//                     body: request.body ? request.body : null
//                 },
//                 {
//                     status(code) {
//                         statusCode = code
//                     },
//                     header(name, value) {
//                         headers.set(name, value)
//                     },
//                     send(body: any) {
//                         if (body === undefined) {
//                             responseBody = ''
//                         } else if (typeof body === 'string' || body instanceof Uint8Array) {
//                             responseBody = body
//                         } else {
//                             headers.set('content-type', 'application/json')
//                             responseBody = JSON.stringify(body)
//                         }
//                     },
//                     text(text: string | Buffer) {
//                         responseBody = text
//                     },
//                     json(json: any) {
//                         headers.set('content-type', 'application/json')
//                         responseBody = JSON.stringify(json)
//                     },
//                     type(contentType: string) {
//                         headers.set('content-type', contentType)
//                     }
//                 }
//             )
//
//             return new Response(
//                 typeof responseBody === 'object' && !(responseBody instanceof Uint8Array)
//                     ? JSON.stringify(responseBody)
//                     : responseBody,
//                 {status: statusCode, headers}
//             )
//         }
//
//         return {
//             async listen() {
//                 console.warn('Web runtime does not support listening')
//             },
//             async close() {
//                 console.warn('Web runtime does not support closing')
//             },
//             async handle(request: Request) {
//                 return fetching(request, handler)
//             }
//         }
//     }
// }