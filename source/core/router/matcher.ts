import {Route} from '.'

export class RouteMatcher {
    protected _routes = new Map<string, Route>()

    protected getKey(route: Route): string {
        return `${route.method}:${route.path}`
    }

    get routes(): Map<string, Route> {
        return this._routes
    }

    add(route: Route): this {
        this._routes.set(this.getKey(route), route)
        return this;
    }

    has(route: Route): boolean {
        return this._routes.has(this.getKey(route))
    }

    find(route: Route): Route | undefined {
        return this._routes.get(this.getKey(route))
    }

    replace(route: Route): this {
        if (this.has(route)) {
            this._routes.set(this.getKey(route), route)
        }
        return this;
    }

    upsert(route: Route): this {
        this._routes.set(this.getKey(route), route)
        return this
    }

    remove(route: Route): this {
        this._routes.delete(this.getKey(route))
        return this;
    }

    match(method: string, url: string): Route | null {
        let best: Route | null = null
        let bestParamCount = Number.MAX_SAFE_INTEGER

        for (const route of this._routes.values()) {
            if (!route.match(method, url)) continue

            const paramCount = route.params.length
            if (paramCount < bestParamCount) {
                bestParamCount = paramCount
                best = route

                if (paramCount === 0) break
            }
        }

        return best ? best.extractParams(url) : null
    }

    clear(): this {
        this._routes.clear()
        return this;
    }
}
