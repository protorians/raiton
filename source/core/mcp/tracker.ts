import {Route} from "../router"

const mcpRouteMap = new Map<string, Route[]>()

export class McpRouteTracker {
    static getRoutes(serverName: string): Route[] {
        return mcpRouteMap.get(serverName) || []
    }

    static setRoutes(serverName: string, routes: Route[]): void {
        mcpRouteMap.set(serverName, routes)
    }

    static removeRoutes(serverName: string, router?: { remove(route: Route): void }): void {
        const routes = mcpRouteMap.get(serverName)
        if (!routes) return
        if (router) {
            for (const route of routes) {
                router.remove(route)
            }
        }
        mcpRouteMap.delete(serverName)
    }

    static clear(): void {
        mcpRouteMap.clear()
    }
}