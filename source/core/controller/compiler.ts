import {ApplicationInterface} from "../../types/application.ts";
import {getControllerMetadata} from "./metadata.ts";
import {createHandler} from "../router/handler.ts";
import {Injection} from "../injection/index.ts";
import {ControllerMetaInterface} from "../../types/index.ts";
import {ControllerRouteTracker} from "./tracker.ts";
import {CacheManager} from "../../framework/cache/cache.ts";

export function compileController(
    ControllerClass: any,
    app: ApplicationInterface
) {
    const instance: any = Injection.resolve<typeof ControllerClass>(ControllerClass)
    const metadata: ControllerMetaInterface = getControllerMetadata(ControllerClass.prototype)
    const name = ControllerClass.name

    const rootScope = (app as any).root
    if (rootScope?.router) {
        ControllerRouteTracker.removeRoutes(name, rootScope.router)
    }

    const routes: any[] = []
    for (const route of metadata.routes) {
        // HMR: a modified handler must never be served from the previous
        // @Cache entry.
        CacheManager.invalidateRoute(`${metadata.prefix ?? ''}${route.path}`)
        const handler = createHandler(instance, route, metadata)
        const path = `${metadata.prefix ?? ''}${route.path}`
        // `Application.route()` intentionally returns `this` for chaining, so
        // use the router directly to track the actual Route (HMR needs to
        // remove it by identity).
        const registered = rootScope?.router
            ? rootScope.router.add(route.method as any, path, handler)
            : app.route(route.method as any, path, handler)
        routes.push(registered)
    }

    ControllerRouteTracker.setRoutes(name, routes)
    return instance;
}
