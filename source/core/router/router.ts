import {RouteHandler} from '@/types'
import {HttpMethod} from "@/sdk/enums";
import {Route} from '@/core/router/route'
import {RouteMatcher} from '@/core/router/matcher'

export class Router {
    private matcher = new RouteMatcher()

    add(method: HttpMethod, path: string, handler: RouteHandler, version?: string) {
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
}
