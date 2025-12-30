import {PluginScope} from '@/core/plugins/scope'
import {RequestContext} from './context'
import {ApplicationConfig, ApplicationInterface} from "@/types/application";
import {HttpMethod} from "@/sdk";
import {RouteHandler} from "@/types";
import {Logger} from "@protorians/logger";

export class Application implements ApplicationInterface {
    private root: PluginScope

    constructor(
        readonly config: ApplicationConfig
    ) {
        this.root = new PluginScope()
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

    // public setOption<K extends keyof ApplicationConfig>(key: K, value: ApplicationConfig[K]): this {
    //     this.config[key] = value;
    //     return this;
    // }
    //
    // public setOptions(options: ApplicationConfig): this {
    //     Object.assign(this.config, options);
    //     return this;
    // }

    register(plugin: any): this {
        this.root.register(plugin)
        return this
    }

    use(mw: any): this {
        this.root.use(mw)
        return this
    }

    route(method: HttpMethod, path: string, handler: RouteHandler, version?: string): this {
        this.root.route(method, path, handler, version)
        return this
    }

    get(path: string, handler: RouteHandler, version?: string): this {
        return this.route(HttpMethod.GET, path, handler, version)
    }

    post(path: string, handler: RouteHandler, version?: string): this {
        return this.route(HttpMethod.POST, path, handler, version)
    }

    patch(path: string, handler: RouteHandler, version?: string): this {
        return this.route(HttpMethod.PATCH, path, handler, version)
    }

    put(path: string, handler: RouteHandler, version?: string): this {
        return this.route(HttpMethod.PUT, path, handler, version)
    }

    delete(path: string, handler: RouteHandler, version?: string): this {
        return this.route(HttpMethod.DELETE, path, handler, version)
    }

    options(path: string, handler: RouteHandler, version?: string): this {
        return this.route(HttpMethod.OPTIONS, path, handler, version)
    }

    head(path: string, handler: RouteHandler, version?: string): this {
        return this.route(HttpMethod.HEAD, path, handler, version)
    }

    trace(path: string, handler: RouteHandler, version?: string): this {
        return this.route(HttpMethod.TRACE, path, handler, version)
    }

    async handle(req: any, reply: any): Promise<any> {
        const ctx = new RequestContext(req, reply)

        await this.root.hooks.run('onRequest', ctx)

        const route = this.root.router.match(
            req.method,
            new URL(req.url, this.hostname).pathname
        )

        if (!route) {
            reply.status(404)
            return reply.send({error: false, statusCode: 404})
        }

        const pipeline = this.root.middleware.clone()
        pipeline.use(async (ctx) => {
            (ctx as any).params = route.parameters
            ctx.reply.send(await route.handler(ctx))
        })

        await pipeline.run(ctx)
        await this.root.hooks.run('onResponse', ctx)
    }
}
