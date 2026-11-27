import {RouteHandlerCallable} from '../../types/index.ts'
import {HttpMethod} from "../../framework/enums/index.ts";
import {Route} from './route.ts'
import {RouteMatcher} from './matcher.ts'

export class Router {
    private matcher = new RouteMatcher()

    add(method: HttpMethod, path: string, handler: RouteHandlerCallable, version?: string) {
        const route = new Route({
            method,
            path,
            handler,
            version
        })
        this.matcher.add(route)
        return route
    }

    remove(route: Route) {
        this.matcher.remove(route)
    }

    match(method: string, url: string) {
        return this.matcher.match(method, url)
    }

    /**
     * Return a route matching the URL regardless of method. Used to answer 405
     * instead of 404 when the path exists.
     */
    matchPath(url: string) {
        for (const route of this.matcher.routes.values()) {
            if (route.match(route.method, url)) return route;
        }
        return null;
    }

    reset() {
        this.matcher.clear()
    }

    getRoutes(): Route[] {
        return Array.from(this.matcher.routes.values())
    }
}