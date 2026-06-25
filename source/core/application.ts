import {Security, bodyParserPlugin} from "../framework/plugins";
import {PluginScope} from './plugins/scope'
import {RequestContext} from './context'
import {ApplicationConfigInterface, ApplicationInterface} from "../types/application";
import {HttpMethod} from "../framework";
import {RouteHandlerCallable} from "../types";
import {Logger} from "@protorians/logger";
import {RaitonConfig} from "./config";
import {Artifacts} from "../framework/artifacts";
import {Injection} from "./injection";

export class Application implements ApplicationInterface {
    private root: PluginScope

    readonly version: string = RaitonConfig.get('version') || '0.0.1'

    static get container(): typeof Injection{
        return Injection;
    }

    constructor(
        readonly config: ApplicationConfigInterface
    ) {
        this.root = new PluginScope()
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
        return `${
            this.config.protocole || 'http'
        }://${
            this.config.hostname || 'localhost'
        }${
            this.config.port ? `:${this.config.port}` : ''
        }${
            this.config.pathname || '/'
        }`
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
        const prefix = this.config.prefix ?? ''
        const fullPath = `${prefix}${path}`.replace(/\/+/g, '/') || '/'
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
                    return reply.send({error: false, statusCode: 404})
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
                return reply.send({error: false, statusCode: 404})
            }

            try {
                (context as any).params = route.parameters;
                let responses = await route.handler(context)

                context.reply.send(responses)
            } catch (e: any) {
                Logger.error('Failed to handle request', e.message ?? e)
                if (this.config.develop) {
                    console.error(e)
                }
            }
        }

        await this.root.middleware.run(ctx, handler)
        await this.root.hooks.run('onResponse', ctx)
    }
}
