import http from 'node:http'
import https from 'node:https'
import {
    RuntimeAdapterInterface,
    RuntimeRequestInterface,
    RuntimeReplyInterface,
    RuntimeServerOptionsInterface
} from '../../../types'
import { NodeRequest } from './request'
import { NodeReply } from './reply'

export const nodeRuntime: RuntimeAdapterInterface = {
    createServer(handler, options?: RuntimeServerOptionsInterface) {
        const requestHandler = async (req: any, res: any) => {
            const runtimeReq: any = new NodeRequest(req)
            const runtimeReply: RuntimeReplyInterface = new NodeReply(res)

            await handler(runtimeReq, runtimeReply)
        }

        let server: http.Server | https.Server

        if (options?.https?.enabled && options.https.certificate) {
            server = https.createServer({
                cert: options.https.certificate.cert,
                key: options.https.certificate.key,
                ca: options.https.certificate.ca,
                passphrase: options.https.certificate.passphrase,
            }, requestHandler as any)
        } else {
            server = http.createServer(requestHandler as any)
        }

        return {
            listen(port, hostname) {
                return new Promise((resolve) =>
                    server.listen(port, hostname, resolve)
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