import {Security, bodyParserPlugin} from "../framework/plugins";
import {PluginScope} from './plugins/scope'
import {RequestContext} from './context'
import {ApplicationConfigInterface, ApplicationInterface} from "../types/application";
import {HttpException, HttpMethod, ThrowableResponse, RaitonResponses, HttpStatus} from "../framework";
import {RouteHandlerCallable} from "../types";
import {Logger} from "@protorians/logger";
import {RaitonConfig} from "./config";
import {Artifacts} from "../framework/artifacts";
import {Injection} from "./injection";
import {HttpsConfigInterface, resolveHttpsConfig} from "../framework/utilities/https";

export class Application implements ApplicationInterface {
    private root: PluginScope
    private _resolvedHttps: HttpsConfigInterface | undefined

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

        return this;
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

    register(plugin: any): this {
        this.root.register(plugin)
        return this
    }

    use(mw: any): this {
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

    async handle(req: any, reply: any): Promise<any> {
        const ctx = new RequestContext(req, reply)

        if (this.config.verbose) {
            Logger.info(
                `Incoming request: ${req.method} ${req.url}`
            )
        }

        await this.root.hooks.run('onRequest', ctx)

        const handler: any = async (param: any) => {
            const context = param.context ?? param;
            const req = context.req;
            const reply = context.reply;

            const url = new URL(req.url, this.hostname)
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
                    reply.status(404)
                    return reply.send(RaitonResponses('Not Found', null, HttpStatus.NOT_FOUND, {error: false}))
                }
            }

            const route = this.root.router.match(
                req.method,
                pathname
            )

            if (!route) {
                if (this.config.verbose) {
                    Logger.warn(`Route not found: ${req.method} ${pathname}`)
                }
                reply.status(404)
                return reply.send(RaitonResponses('Not Found', null, HttpStatus.NOT_FOUND, {error: false}))
            }

            try {
                (context as any).params = route.parameters;
                let responses = await route.handler(context)

                if (responses instanceof ThrowableResponse) {
                    context.reply.status(responses.statusCode ?? 500)
                }
                if (responses instanceof HttpException) {
                    context.reply.status(responses.statusCode ?? 500)
                }

                context.reply.send(responses)
            } catch (e: any) {
                Logger.info(`${req.method} ${req.url}`)
                Logger.error('Failed to execute handle', e.message ?? e)
                if (this.config.develop) {
                    console.error(e)
                }
                context.reply.status(500)
                context.reply.send(RaitonResponses('Internal Server Error', null, HttpStatus.INTERNAL_SERVER_ERROR, {error: true}))
            }
        }

        try {
            await this.root.middleware.run(ctx, handler)
            await this.root.hooks.run('onResponse', ctx)
        } catch (err: any) {
            Logger.info(`${req.method} ${req.url}`)
            if (err instanceof HttpException || err instanceof ThrowableResponse) {
                Logger.error(`Server error`, err.message ?? err);
                ctx.reply.status(err.statusCode ?? 500)
                return ctx.reply.send(err.render())
            }
            ctx.reply.send(RaitonResponses(err.message ?? err, null, HttpStatus.INTERNAL_SERVER_ERROR, {error: true}))
        }
    }
}
