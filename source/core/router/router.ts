import {RouteHandlerCallable} from '../../types/index.ts'
import {HttpMethod} from "../../framework/enums/http-method.enum.ts";
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

    replace(route: Route) {
        this.matcher.replace(route)
        return route
    }

    /**
     * Compatibilité : renvoie la `Route` correspondante. Les paramètres ne sont
     * plus stockés sur l'instance ; utilisez `resolve()` pour les obtenir.
     */
    match(method: string, url: string) {
        return this.matcher.match(method, url)
    }

    /** Résout la route et les paramètres propres à cette requête. */
    resolve(method: string, url: string) {
        return this.matcher.resolve(method, url)
    }

    /**
     * Return a route matching the URL regardless of method. Used to answer 405
     * instead of 404 when the path exists.
     */
    matchPath(url: string) {
        for (const route of this.matcher.routes.values()) {
            if (route.matchesPath(url)) return route;
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
