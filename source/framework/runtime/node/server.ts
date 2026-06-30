import http from 'node:http'
import {
    RuntimeAdapterInterface,
    RuntimeRequestInterface,
    RuntimeReplyInterface
} from '../../../types'
import { NodeRequest } from './request'
import { NodeReply } from './reply'

export const nodeRuntime: RuntimeAdapterInterface = {
    createServer(handler) {
        const server = http.createServer(async (req, res) => {
            const runtimeReq: any = new NodeRequest(req)
            const runtimeReply: RuntimeReplyInterface = new NodeReply(res)

            await handler(runtimeReq, runtimeReply)
        })

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