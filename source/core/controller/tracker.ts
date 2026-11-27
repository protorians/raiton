import {Route} from "../router/index.ts"

export type RouteOrigin = "scan" | "bridge"

const controllerRouteMap = new Map<string, Route[]>()

function trackerKey(controllerName: string, origin: RouteOrigin = "scan", key?: string): string {
    if (key) return key
    return origin === "bridge" ? `bridge:${controllerName}` : controllerName
}

/**
 * Route ownership tracker. Bridge-owned routes use a distinct key so removing a
 * bridge controller can never delete a local controller route that happens to
 * share the same class name.
 */
export class ControllerRouteTracker {
    static getRoutes(controllerName: string, origin: RouteOrigin = "scan", key?: string): Route[] {
        return controllerRouteMap.get(trackerKey(controllerName, origin, key)) || []
    }

    static setRoutes(controllerName: string, routes: Route[], origin: RouteOrigin = "scan", key?: string): void {
        controllerRouteMap.set(trackerKey(controllerName, origin, key), routes)
    }

    static removeRoutes(
        controllerName: string,
        router: { remove(route: Route): void },
        origin: RouteOrigin = "scan",
        key?: string,
    ): void {
        const tracker = trackerKey(controllerName, origin, key)
        const routes = controllerRouteMap.get(tracker)
        if (!routes) return
        for (const route of routes) {
            router.remove(route)
        }
        controllerRouteMap.delete(tracker)
    }

    static clear(): void {
        controllerRouteMap.clear()
    }

    static has(controllerName: string, origin: RouteOrigin = "scan", key?: string): boolean {
        return controllerRouteMap.has(trackerKey(controllerName, origin, key))
    }
}
