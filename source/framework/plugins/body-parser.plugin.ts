import type {MiddlewareParametersInterface, PluginInterface} from "../../types/index.ts";
import {RequestContext} from "../../core/context.ts";
import {Logger} from "@protorians/logger";
import {tryParseJson} from "../utilities/json.util.ts";

const textDecoder = new TextDecoder()
const installedScopes = new WeakSet<object>()

export function bodyParserPlugin(): PluginInterface {
    return {
        name: 'body-parser-plugin',
        setup: (scope) => {
            // Installing the plugin twice would run the parser twice and read
            // the request stream a second time.
            if (installedScopes.has(scope as object)) return
            installedScopes.add(scope as object)

            scope.use(async ({context, next}: MiddlewareParametersInterface) => {
                const url = getRequestUrl(context)
                readQueryBody(context, url);

                const method = context.req.method.toUpperCase();

                // GET/HEAD never carry a body: expose the already-parsed query
                // without touching content-type or the body stream.
                if (method === 'GET' || method === 'HEAD') {
                    context.req.body = context.req.query;
                    await next();
                    return;
                }

                const hasBody = context.req.body !== undefined && context.req.body !== null;

                if (hasBody && !context.state.bodyParsed) {
                    try {
                        const contentType = context.req.headers.get('content-type') || '';
                        const rawBody = await readRawBody(context.req.body);
                        const bodyString = decode(rawBody);

                        if (contentType.includes('multipart/form-data')) {
                            await readMultipartBody(context, rawBody);
                        } else if (contentType.includes('application/json')) {
                            context.req.body = tryParseJson(bodyString) || {};
                            context.state.bodyParsed = true;
                        } else if (contentType.includes('application/x-www-form-urlencoded')) {
                            readUrlEncodedBody(context, bodyString);
                        } else if (contentType.includes('text/')) {
                            context.req.body = bodyString as unknown as any;
                            context.state.bodyParsed = true;
                        }

                        if (!context.state.bodyParsed) {
                            context.req.body = rawBody as any;
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

async function readMultipartBody(ctx: RequestContext, rawBody: Uint8Array | string) {
    try {
        const tempRequest = new Request(ctx.req.url, {
            method: ctx.req.method,
            headers: ctx.req.headers,
            body: rawBody as BodyInit
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

function readUrlEncodedBody(ctx: RequestContext, body: string) {
    const params = new URLSearchParams(body);
    const record: Record<string, any> = {};
    params.forEach((value, key) => {
        record[key] = value;
    });
    ctx.req.body = record as unknown as any;
    ctx.state.bodyParsed = true;
}

function getRequestUrl(ctx: RequestContext): URL {
    const cached = ctx.state?.url;
    if (cached instanceof URL) return cached

    const url = new URL(ctx.req.url, 'http://localhost')
    ctx.state.url = url
    return url
}

function readQueryBody(ctx: RequestContext, url: URL) {
    // Avoid allocating URLSearchParams when the request has no query string.
    if (!url.search) {
        ctx.req.query = {} as unknown as any;
        return
    }

    const record = {} as Record<string, any>;
    url.searchParams.forEach((value, key) => record[key] = value);
    ctx.req.query = record as unknown as any;
}

export async function readRawBody(body: any): Promise<Uint8Array | string> {
    if (!body) return new Uint8Array(0);

    if (body instanceof Uint8Array || typeof body === 'string') {
        return body;
    }

    // Fetch/Web streams (Bun, Deno, Workers): let the runtime decode the body
    // through the native Response path instead of a manual reader loop.
    if (body instanceof ReadableStream) {
        return new Uint8Array(await new Response(body).arrayBuffer());
    }

    if (typeof body === 'object' && !('on' in body)) {
        return JSON.stringify(body);
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
    return textDecoder.decode(data);
}
