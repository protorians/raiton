import type {MiddlewareParameters, Plugin} from "../../types";
import {RequestContext} from "../../core/context";
import {Logger} from "@protorians/logger";
import {tryParseJson} from "../utilities/json.util";

export function bodyParserPlugin(): Plugin {
    return {
        name: 'body-parser-plugin',
        setup: (scope) => {
            scope.use(async ({context, next}: MiddlewareParameters) => {
                const contentType = context.req.headers.get('content-type') || '';

                if (context.req.body && !context.state.bodyParsed) {
                    try {
                        const rawBody = await readRawBody(context.req.body);
                        context.req.body = rawBody as unknown as any;
                        const bodyString = decode(rawBody);

                        readQueryBody(context);
                        await readMultipartBody(context, contentType);
                        readJsonBody(context, contentType, bodyString);
                        readUrlEncodedBody(context, contentType, bodyString);
                        readTextBody(context, contentType, bodyString);

                        if (!context.state.bodyParsed) {
                            context.state.bodyParsed = true;
                        }

                    } catch (e) {
                        Logger.error('Error parsing body:', e);
                    }
                }

                await next();
            });
        }
    };
}

function readJsonBody(ctx: RequestContext, contentType: string, body: any) {
    if (contentType.includes('application/json')) {
        ctx.req.body = tryParseJson(body) || {} as unknown as any;
        ctx.state.bodyParsed = true;
    }
}

async function readMultipartBody(ctx: RequestContext, contentType: string) {
    if (contentType.includes('multipart/form-data')) {
        const body = ctx.req.body;

        try {
            const tempRequest = new Request(ctx.req.url, {
                method: ctx.req.method,
                headers: ctx.req.headers,
                body: body as any
            });

            const formData = await tempRequest.formData();
            const record: Record<string, any> = {};
            const files: Record<string, any> = {};

            for (const [key, value] of formData.entries()) {
                const v = value as any;
                if (v && (v instanceof File)) {
                    files[key] = {
                        name: v.name,
                        type: v.type,
                        size: v.size,
                        lastModified: v.lastModified,
                        buffer: Buffer.from(await v.arrayBuffer())
                    };
                } else {
                    record[key] = value;
                }
            }

            ctx.req.body = record;
            ctx.req.files = files;
            ctx.req.file = Object.values(files)[0] || null;
            ctx.state.bodyParsed = true;
        } catch (e) {
            Logger.error('Error parsing multipart body:', e);
        }
    }
}

function readUrlEncodedBody(ctx: RequestContext, contentType: string, body: string) {
    if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams(body);
        const record: Record<string, any> = {};
        params.forEach((value, key) => {
            record[key] = value;
        });
        ctx.req.body = record as unknown as any;
        ctx.state.bodyParsed = true;
    }
}

function readTextBody(ctx: RequestContext, contentType: string, body: string) {
    if (contentType.includes('text/')) {
        ctx.req.body = body as unknown as any;
        ctx.state.bodyParsed = true;
    }
}

function readQueryBody(ctx: RequestContext) {
    const searchParams = new URLSearchParams(ctx.req.url.split('?')[1] || '');
    const record = {} as Record<string, any>;
    searchParams.forEach((value, key) => record[key] = value);
    ctx.req.query = record as unknown as any;
}

async function readRawBody(body: any): Promise<Uint8Array | string> {
    if (body instanceof ReadableStream) {
        const reader = body.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result;
    }

    if (typeof body === 'object' && body !== null && 'on' in body && typeof body.on === 'function') {
        return new Promise((resolve, reject) => {
            const chunks: any[] = [];
            body.on('data', (chunk: any) => chunks.push(chunk));
            body.on('end', () => {
                if (chunks.length > 0 && typeof chunks[0] === 'string') {
                    resolve(chunks.join(''));
                } else {
                    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                    const result = new Uint8Array(totalLength);
                    let offset = 0;
                    for (const chunk of chunks) {
                        result.set(new Uint8Array(chunk), offset);
                        offset += chunk.length;
                    }
                    resolve(result);
                }
            });
            body.on('error', reject);
        });
    }

    return body;
}

function decode(data: Uint8Array | string): string {
    if (typeof data === 'string') return data;
    return new TextDecoder().decode(data);
}
