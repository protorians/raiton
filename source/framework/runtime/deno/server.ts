import {RuntimeAdapterInterface, RuntimeRequestInterface, RuntimeReplyInterface} from '../../../types'
import {Logger} from "@protorians/logger";

// class DenoRequest implements RuntimeRequestInterface {
//   constructor(private req: Request) {}
//   get method(): string { return this.req.method; }
//   get url(): string { return this.req.url; }
//   get headers(): Headers { return new Headers(this.req.headers); }
//   get body(): any { return this.req.body; }
//   get query(): Record<string, any> | undefined { return undefined; }
//   get params(): Record<string, any> | undefined { return undefined; }
//   get file(): any { return undefined; }
//   get files(): any { return undefined; }
//   get remoteAddress(): string | undefined { return undefined; }
// }

// class DenoReply implements RuntimeReplyInterface {
//   private statusCode: number = 200;
//   private headers: Headers = new Headers();
//   private body: BodyInit | null = null;
//
//   status(code: number): void { this.statusCode = code; }
//   header(name: string, value: string): void { this.headers.set(name, value); }
//   send(body: any): void {
//     if (body === undefined) {
//       this.body = null;
//     } else if (typeof body === 'string' || body instanceof Uint8Array) {
//       this.body = body;
//     } else {
//       if (!this.headers.has('content-type')) {
//         this.headers.set('content-type', 'application/json');
//       }
//       this.body = JSON.stringify(body);
//     }
//   }
//   text(text: string | Buffer): void {
//     // Accept string, Uint8Array, or any other value (including Buffer-like)
//     if (typeof text === 'string' || text instanceof Uint8Array) {
//       this.body = text;
//     } else {
//       // Fallback: treat as JSON string
//       this.body = JSON.stringify(text);
//     }
//   }
//   json(json: any): void {
//     this.headers.set('content-type', 'application/json');
//     this.body = JSON.stringify(json);
//   }
//   type(contentType: string): void {
//     this.headers.set('content-type', contentType);
//   }
//   toResponse(): Response {
//     let bodyToSend: BodyInit = '';
//     if (this.body instanceof Uint8Array) {
//       bodyToSend = this.body;
//     } else if (typeof this.body === 'string') {
//       bodyToSend = this.body;
//     } else if (this.body === null) {
//       bodyToSend = '';
//     } else {
//       // fallback: treat as JSON
//       bodyToSend = JSON.stringify(this.body);
//     }
//     return new Response(bodyToSend, { status: this.statusCode, headers: this.headers });
//   }
// }

/**
 * @alpha Not ready
 */
export const denoRuntime: RuntimeAdapterInterface = {
    createServer(handler) {
        let controller: AbortController | null = null;

        return {
            async listen(port, hostname) {
                // controller = new AbortController();
                //
                // const server = Deno.serve({
                //     port: Number(port),
                //     hostname,
                //     signal: controller.signal,
                //     handler: async (reqEvent) => {
                //         const denoReq = new DenoRequest(reqEvent.request);
                //         const denoRes = new DenoReply();
                //
                //         await handler(denoReq, denoRes);
                //
                //         const resp = denoRes.toResponse();
                //         await reqEvent.respondWith(resp);
                //     }
                // });

                // Server will run until close() is called
            },
            async close() {
                // if (controller) {
                //     controller.abort();
                // }
                // Note: Deno.serve does not expose a direct stop; closing the signal aborts incoming connections.
            }
        };
    }
}