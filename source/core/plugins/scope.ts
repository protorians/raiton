import {HookStore} from '@/core/hooks'
import {MiddlewarePipeline} from '@/core/middleware'
import {Route, Router} from '@/core/router'

export class PluginScope {
    public hooks: HookStore
    public middleware: MiddlewarePipeline
    public router: Router

    constructor(parent?: PluginScope) {
        this.hooks = parent ? parent.hooks.clone() : new HookStore()
        this.middleware = parent
            ? parent.middleware.clone()
            : new MiddlewarePipeline()
        this.router = parent ? parent.router : new Router()
    }

    addHook(name: any, fn: any): this {
        this.hooks.add(name, fn)
        return this;
    }

    use(mw: any): this {
        if (typeof mw === 'object' && mw !== null && 'setup' in mw && typeof mw.setup === 'function' && mw.setup.length === 1) {
            mw.setup(this)
            return this
        }
        this.middleware.use(mw)
        return this;
    }

    route(
        method: any,
        path: string,
        handler: any,
        version?: string
    ): Route {
        return this.router.add(method, path, handler, version)
    }

    register(plugin: any): PluginScope {
        const child = new PluginScope(this)
        plugin.setup(child)
        return child
    }
}
