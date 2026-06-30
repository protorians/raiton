import {HookStore} from '../hooks'
import {MiddlewarePipeline} from '../middleware'
import {Route, Router} from '../router'
import {HttpMethod} from "../../framework/enums";

export class PluginScope {
    public hooks: HookStore
    public middleware: MiddlewarePipeline
    public router: Router
    private parent?: PluginScope

    constructor(parent?: PluginScope) {
        this.parent = parent
        this.hooks = parent ? parent.hooks : new HookStore()
        this.middleware = parent
            ? parent.middleware
            : new MiddlewarePipeline()
        this.router = parent ? parent.router : new Router()
    }

    addHook(name: any, fn: any): this {
        this.hooks.add(name, fn)
        return this;
    }

    use(mw: any): any {
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

    get(path: string, handler: any, version?: string): Route {
        return this.route(HttpMethod.GET, path, handler, version)
    }

    register(plugin: any): this {
        if (typeof plugin === 'object' && plugin !== null && 'setup' in plugin && typeof plugin.setup === 'function' && plugin.setup.length === 1) {
            plugin.setup(this)
            return this
        }
        const child = new PluginScope(this)
        plugin.setup(child)
        return this
    }
}