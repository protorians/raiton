import {Security} from "../framework/plugins/security/index.ts";
import {bodyParserPlugin} from "../framework/plugins/body-parser.plugin.ts";
import {PluginScope} from './plugins/scope.ts'
import {RequestContext} from './context.ts'
import {ApplicationConfigInterface, ApplicationInterface} from "../types/application.ts";
import {HttpException} from "../framework/exceptions/http-exception.ts";
import {HttpMethod} from "../framework/enums/http-method.enum.ts";
import {ThrowableResponse} from "../framework/responses/http-throwable.ts";
import {HttpStatus} from "../framework/enums/http-status.enum.ts";
import {RouteHandlerCallable} from "../types/index.ts";
import {Logger} from "@protorians/logger";
import {RaitonConfig} from "./config/index.ts";
import {Raiton} from "./raiton.ts";
import {Artifacts} from "../framework/artifacts.ts";
import {Injection} from "./injection/index.ts";
import {HttpsConfigInterface, resolveHttpsConfig} from "../framework/utilities/https.util.ts";
import {observabilityPlugin} from "../framework/observability/plugin.ts";
import {devPagePlugin, watchDevPageHmr} from "../framework/plugins/dev.plugin.ts";
import {shutdown} from "../framework/observability/shutdown.ts";
import {resolveRequestId} from "../framework/observability/request.ts";
import {enrichErrorPayload, errorPayload, hintFor} from "../framework/errors/catalog.ts";
import {suggestRoute} from "../framework/utilities/route-suggestion.util.ts";
import {resolveDebugConfig} from "../debug/config.ts";
import {configureDebug, recordDebugLog, type DebugRuntimeState} from "../debug/runtime.ts";
import {debugPlugin} from "../debug/surface.ts";
import {firstUserFrame, stackLines} from "../debug/source.ts";

export class Application implements ApplicationInterface {
    private root: PluginScope
    private _resolvedHttps: HttpsConfigInterface | undefined
    private readonly _observability = RaitonConfig.getObservability()
    private readonly _plugins = new Set<string>()
    private _debug?: DebugRuntimeState

    readonly version: string = RaitonConfig.get('version') || '0.0.1'

    static get container(): typeof Injection {
        return Injection;
    }

    constructor(
        readonly config: ApplicationConfigInterface
    ) {
        this.root = new PluginScope()
        this._resolvedHttps = resolveHttpsConfig(this.config.https)
        if (this.config.workdir) {
            process.chdir(this.config.workdir)
        }
        this.initialize()
    }

    protected initialize(): this {
        const artifacts = RaitonConfig.get('artifacts')
        const artifactTypes = [...artifacts?.types || [], ...Artifacts.defaultTypes]

        Artifacts.registerMany(...artifactTypes)

        this.register(Security.headers)
        this.register(bodyParserPlugin())

        const observability = this._observability
        if (observability.mode !== 'off') {
            this.register(observabilityPlugin(observability))
        }

        // Development page: never mounted in production (HMR/develop only).
        const devPage = RaitonConfig.get('devPage')
        if (this.development && devPage?.enabled !== false) {
            this.register(devPagePlugin({path: devPage?.path ?? '/__dev'}))
            watchDevPageHmr()
        }

        // AI-assisted debug surfaces are opt-in: disabled by default outside
        // development and never mounted unless explicitly enabled.
        const debugWorkdir = this.config.workdir ?? process.cwd()
        const debugConfig = resolveDebugConfig({
            development: this.development,
            workdir: debugWorkdir,
        })
        this._debug = configureDebug({
            config: debugConfig,
            development: this.development,
            workdir: debugWorkdir,
            application: this,
        })
        if (debugConfig.enabled) {
            this.register(debugPlugin(this._debug))
        }

        return this;
    }

    /**
     * Development mode follows HMR, explicit `develop`, or NODE_ENV.
     */
    public get development(): boolean {
        return Boolean(
            this.config.develop
            || Raiton.thread?.builder?.options?.hmr
            || process.env.NODE_ENV === 'development'
        )
    }

    public get hostname(): string {
        const protocol = this._resolvedHttps?.enabled
            ? 'https'
            : (this.config.protocole || 'http')

        return `${
            protocol
        }://${
            this.config.hostname || 'localhost'
        }${
            this.config.port ? `:${this.config.port}` : ''
        }${
            this.config.pathname || '/'
        }`
    }

    public get https(): HttpsConfigInterface | undefined {
        return this._resolvedHttps
    }

    public setOption<K extends keyof ApplicationConfigInterface>(key: K, value: ApplicationConfigInterface[K]): this {
        this.config[key] = value;
        return this;
    }

    public setOptions(options: ApplicationConfigInterface): this {
        Object.assign(this.config, options);
        return this;
    }

    /**
     * Attach a debug runtime after construction. Used by CLI tooling that
     * boots the application without a socket and then enables the journal for
     * in-process invocation and verification.
     */
    public adoptDebugRuntime(runtime: DebugRuntimeState): this {
        this._debug = runtime;
        return this;
    }

    register(plugin: any): this {
        if (plugin && typeof plugin === 'object' && typeof plugin.name === 'string') {
            if (this._plugins.has(plugin.name)) return this
            this._plugins.add(plugin.name)
        }
        this.root.register(plugin)
        return this
    }

    use(mw: any): this {
        // Plugin objects are installed once by name (idempotent body parser,
        // security and observability registration).
        if (mw && typeof mw === 'object' && typeof mw.name === 'string' && typeof mw.setup === 'function') {
            if (this._plugins.has(mw.name)) return this
            this._plugins.add(mw.name)
        }
        this.root.use(mw)
        return this
    }

    route(method: HttpMethod, path: string, handler: RouteHandlerCallable, version?: string): this {
        const fullPath = path.replace(/\/+/g, '/') || '/'
        this.root.route(method, fullPath, handler, version)
        return this
    }

    get(path: string, handler: RouteHandlerCallable, version?: string): this {
        return this.route(HttpMethod.GET, path, handler, version)
    }

    post(path: string, handler: RouteHandlerCallable, version?: string): this {
        return this.route(HttpMethod.POST, path, handler, version)
    }

    patch(path: string, handler: RouteHandlerCallable, version?: string): this {
        return this.route(HttpMethod.PATCH, path, handler, version)
    }

    put(path: string, handler: RouteHandlerCallable, version?: string): this {
        return this.route(HttpMethod.PUT, path, handler, version)
    }

    delete(path: string, handler: RouteHandlerCallable, version?: string): this {
        return this.route(HttpMethod.DELETE, path, handler, version)
    }

    options(path: string, handler: RouteHandlerCallable, version?: string): this {
        return this.route(HttpMethod.OPTIONS, path, handler, version)
    }

    head(path: string, handler: RouteHandlerCallable, version?: string): this {
        return this.route(HttpMethod.HEAD, path, handler, version)
    }

    trace(path: string, handler: RouteHandlerCallable, version?: string): this {
        return this.route(HttpMethod.TRACE, path, handler, version)
    }

    private parseRequestUrl(url: string | undefined): URL {
        try {
            return new URL(url || '/', this.hostname)
        } catch {
            return new URL('/', this.hostname)
        }
    }

    async handle(req: any, reply: any): Promise<any> {
        const release = shutdown.track()
        const observability = this._observability
        const requestId = resolveRequestId(req, observability.requestIdHeader)
        let ctx: any

        try {
            ctx = new RequestContext(req, reply)
            ctx.state.requestId = requestId
            // Parse the URL once per request: the body parser, middleware and
            // router all reuse this instance instead of parsing it again.
            const requestUrl = this.parseRequestUrl(req.url)
            ctx.state.url = requestUrl

            const debug = this._debug?.collector
            if (debug) {
                debug.start(ctx)
                const originalStatus = reply.status.bind(reply)
                reply.status = (code: number) => {
                    ctx.state.responseStatus = code
                    return originalStatus(code)
                }
                if (ctx.state.traceId) {
                    try {
                        reply.header('x-trace-id', ctx.state.traceId)
                    } catch {
                        // A mock reply may not implement `header`; ignore.
                    }
                }
            }

            // During graceful shutdown, new requests are rejected immediately
            // while already-tracked requests are allowed to finish.
            if (shutdown.isDraining) {
                try {
                    reply.status(HttpStatus.SERVICE_UNAVAILABLE)
                    reply.send(errorPayload('SERVICE_UNAVAILABLE', {requestId}))
                } catch {
                    // Ignore transport errors during shutdown.
                }
                return
            }

            // Always expose the correlation id, even when metrics/traces are
            // disabled: it is cheap and makes production logs actionable.
            try {
                reply.header(observability.requestIdHeader, requestId)
            } catch {
                // A mock reply may not implement `header`; ignore.
            }

            if (this.config.verbose) {
                Logger.info(
                    `Incoming request: ${req.method} ${req.url}`
                )
            }

            if (this.root.hooks.has('onRequest')) {
                await this.root.hooks.run('onRequest', ctx)
            }
            const notFound = (pathname: string) => {
                if (this.config.verbose) {
                    Logger.warn(`Route not found: ${req.method} ${pathname} request_id=${requestId}`)
                }
                const body: any = errorPayload('NOT_FOUND', {
                    message: 'Not Found',
                    requestId,
                    hint: hintFor('NOT_FOUND'),
                })
                if (this.development) {
                    const candidates = this.root.router.getRoutes().filter(route =>
                        !(route.handler as any)?._raitonInternal
                        && !route.path.startsWith('/__dev')
                        && !route.path.startsWith('/metrics')
                    )
                    const suggestion = suggestRoute(candidates, req.method, pathname)
                    if (suggestion) body.suggestion = suggestion
                }
                reply.status(HttpStatus.NOT_FOUND)
                debug?.setResponseBody(ctx, body)
                return reply.send(body)
            }

            const handler: any = async (param: any) => {
                const context = param.context ?? param;
                const req = context.req;
                const reply = context.reply;

                const url = (context.state?.url as URL | undefined) ?? new URL(req.url, this.hostname)
                let pathname = url.pathname

                if (this.config.prefix) {
                    const prefix = this.config.prefix.endsWith('/') ? this.config.prefix.slice(0, -1) : this.config.prefix
                    if (pathname === prefix) {
                        pathname = '/'
                    } else if (pathname.startsWith(prefix + '/')) {
                        pathname = pathname.substring(prefix.length) || '/'
                    } else if (this.config.verbose) {
                        Logger.warn(`Request out of application prefix: ${pathname} (expected: ${prefix}/*)`)
                    }
                }

                if (this.config.pathname && this.config.pathname !== '/') {
                    const appPathname = this.config.pathname.endsWith('/') ? this.config.pathname : `${this.config.pathname}/`
                    if (pathname.startsWith(appPathname)) {
                        pathname = pathname.substring(appPathname.length - 1) || '/'
                    } else if (pathname === this.config.pathname) {
                        pathname = '/'
                    } else {
                        if (this.config.verbose) {
                            Logger.warn(`Request out of application pathname: ${pathname} (expected prefix: ${this.config.pathname})`)
                        }
                        return notFound(pathname)
                    }
                }

                const resolved = this.root.router.resolve(
                    req.method,
                    pathname
                )

                if (!resolved) {
                    const pathRoute = this.root.router.matchPath(pathname)
                    if (pathRoute) {
                        const body: any = {
                            ...errorPayload('METHOD_NOT_ALLOWED', {
                                requestId,
                                hint: `Use one of: ${[pathRoute.method].join(", ")}.`,
                            }),
                            allowed: [pathRoute.method],
                        }
                        reply.status(HttpStatus.METHOD_NOT_ALLOWED)
                        debug?.step(ctx, "route", "method-not-allowed", undefined, `${req.method} ${pathname}`)
                        debug?.setResponseBody(ctx, body)
                        return reply.send(body)
                    }
                    debug?.step(ctx, "route", "not-found", undefined, `${req.method} ${pathname}`)
                    return notFound(pathname)
                }

                const route = resolved.route
                context.state.matchedRoutePath = route.version
                    ? `/${route.version}${route.path}`
                    : route.path
                debug?.step(ctx, "route", "resolved", undefined, `${req.method} ${pathname}`)

                try {
                    // Parameters are request-scoped: never read them from the
                    // shared Route instance.
                    (context as any).params = resolved.params;
                    let responses = await route.handler(context)

                    if (responses instanceof ThrowableResponse) {
                        context.reply.status(responses.statusCode ?? 500)
                    }
                    if (responses instanceof HttpException) {
                        context.reply.status(responses.statusCode ?? 500)
                    }
                    // Plain response objects may carry a status (health checks,
                    // generated controllers returning `RaitonResponses`).
                    if (responses && typeof responses === "object" && typeof responses.statusCode === "number") {
                        try {
                            context.reply.status(responses.statusCode)
                        } catch {
                            // Mock replies without status tracking.
                        }
                        if (responses.statusCode >= 400 && responses.error === true) {
                            responses = enrichErrorPayload(responses, responses.statusCode, requestId);
                        }
                    }

                    context.reply.send(responses)
                    debug?.setResponseBody(context, responses)
                } catch (e: any) {
                    Logger.info(`${req.method} ${req.url} request_id=${requestId}`)
                    Logger.error(`Failed to execute handle request_id=${requestId}`, e.message ?? e)
                    if (this.development) {
                        console.error(e)
                    }
                    const location = this.development ? firstUserFrame(e?.stack) : undefined
                    debug?.setError(ctx, {
                        code: "INTERNAL_SERVER_ERROR",
                        message: String(e?.message ?? e),
                        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                        ...(this.development ? {stack: stackLines(e)} : {}),
                        ...(location ? {location} : {}),
                    })
                    recordDebugLog("error", `handle: ${e?.message ?? e}`)
                    const body = errorPayload('INTERNAL_SERVER_ERROR', {
                        requestId,
                        hint: hintFor('INTERNAL_SERVER_ERROR'),
                        ...(this.development ? {
                            details: {message: String(e?.message ?? e)},
                            location,
                            stack: stackLines(e),
                        } : {}),
                    })
                    context.reply.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    context.reply.send(body)
                    debug?.setResponseBody(context, body)
                }
            }

            try {
                await this.root.middleware.run(ctx, handler)
                if (this.root.hooks.has('onResponse')) {
                    await this.root.hooks.run('onResponse', ctx)
                }
            } catch (err: any) {
                Logger.info(`${req.method} ${req.url} request_id=${requestId}`)
                if (err instanceof HttpException || err instanceof ThrowableResponse) {
                    Logger.error(`Server error request_id=${requestId}`, err.message ?? err);
                    const status = err.statusCode ?? 500;
                    const location = this.development ? firstUserFrame(err.stack) : undefined
                    debug?.setError(ctx, {
                        code: typeof (err as any).code === "string" ? (err as any).code : "INTERNAL_SERVER_ERROR",
                        message: String(err.message ?? err),
                        statusCode: status,
                        ...(this.development ? {stack: stackLines(err)} : {}),
                        ...(location ? {location} : {}),
                    })
                    recordDebugLog("error", `server: ${err.message ?? err}`)
                    ctx.reply.status(status)
                    const body = enrichErrorPayload(err.render(), status, requestId, {
                        hint: hintFor("INTERNAL_SERVER_ERROR"),
                        location,
                        stack: this.development ? stackLines(err) : undefined,
                    })
                    debug?.setResponseBody(ctx, body)
                    return ctx.reply.send(body)
                }
                const location = this.development ? firstUserFrame(err?.stack) : undefined
                const body = errorPayload('INTERNAL_SERVER_ERROR', {
                    requestId,
                    hint: hintFor('INTERNAL_SERVER_ERROR'),
                    ...(this.development ? {
                        details: {message: String(err?.message ?? err)},
                        location,
                        stack: stackLines(err),
                    } : {}),
                })
                debug?.setError(ctx, {
                    code: "INTERNAL_SERVER_ERROR",
                    message: String(err?.message ?? err),
                    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
                    ...(this.development ? {stack: stackLines(err)} : {}),
                    ...(location ? {location} : {}),
                })
                recordDebugLog("error", `server: ${err?.message ?? err}`)
                ctx.reply.status(HttpStatus.INTERNAL_SERVER_ERROR)
                debug?.setResponseBody(ctx, body)
                return ctx.reply.send(body)
            }
        } finally {
            this._debug?.collector?.finish(ctx)
            release()
        }
    }
}
