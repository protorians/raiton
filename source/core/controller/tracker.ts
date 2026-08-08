import {Route} from "../router"

const controllerRouteMap = new Map<string, Route[]>()

export class ControllerRouteTracker {
    static getRoutes(controllerName: string): Route[] {
        return controllerRouteMap.get(controllerName) || []
    }

    static setRoutes(controllerName: string, routes: Route[]): void {
        controllerRouteMap.set(controllerName, routes)
    }

    static removeRoutes(controllerName: string, router: { remove(route: Route): void }): void {
        const routes = controllerRouteMap.get(controllerName)
        if (!routes) return
        for (const route of routes) {
            router.remove(route)
        }
        controllerRouteMap.delete(controllerName)
    }

    static clear(): void {
        controllerRouteMap.clear()
    }
}
