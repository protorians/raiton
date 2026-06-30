import {RouteHandlerCallable} from '../../types'
import {HttpMethod} from "../../framework/enums";
import {Route} from './route'
import {RouteMatcher} from './matcher'

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

    reset() {
        this.matcher.clear()
    }

    getRoutes(): Route[] {
        return Array.from(this.matcher.routes.values())
    }
}