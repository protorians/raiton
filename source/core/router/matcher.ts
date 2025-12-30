import {Route} from '@/core/router'

export class RouteMatcher {
    protected routes = new Map<string, Route>()

    protected getKey(route: Route): string {
        return `${route.method}:${route.path}`
    }

    add(route: Route): this {
        this.routes.set(this.getKey(route), route)
        return this;
    }

    has(route: Route): boolean {
        return this.routes.has(this.getKey(route))
    }

    find(route: Route): Route | undefined {
        return this.routes.get(this.getKey(route))
    }

    replace(route: Route): this {
        if (this.has(route)) {
            this.routes.set(this.getKey(route), route)
        }
        return this;
    }

    upsert(route: Route): this {
        this.routes.set(this.getKey(route), route)
        return this
    }

    remove(route: Route): this {
        this.routes.delete(this.getKey(route))
        return this;
    }

    match(method: string, url: string): Route | null {
        for (const route of this.routes.values())
            if (route.match(method, url))
                return route.extractParams(url)
        return null
    }

    clear(): this {
        this.routes.clear()
        return this;
    }
}
