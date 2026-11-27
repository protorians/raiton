import {normalizeRoutePath, Route} from './route.ts'

export interface RouteResolution {
    route: Route
    params: Record<string, string>
}

interface TrieNode {
    static: Map<string, TrieNode>
    param?: TrieNode
    routes: Route[]
}

interface RouteCandidate {
    route: Route
    values: string[]
}

function createNode(): TrieNode {
    return {static: new Map(), routes: []}
}

/**
 * Index de routes à coût prévisible.
 *
 * - Les routes statiques sont résolues par un `Map` (O(1)).
 * - Les routes paramétriques utilisent un trie par segment (O(segments)).
 * - Les motifs sont compilés par `Route` à l'enregistrement.
 *
 * Toutes les opérations (`add`, `remove`, `replace`, `clear`) maintiennent les
 * trois index (toutes les routes, statiques, trie) de façon cohérente, ce qui
 * rend le rechargement HMR sûr.
 */
export class RouteMatcher {
    protected _routes = new Map<string, Route>()
    protected _static = new Map<string, Route>()
    protected _tries = new Map<string, TrieNode>()
    protected _order = 0

    protected getKey(route: Route): string {
        return `${route.method}:${route.fullPath}`
    }

    get routes(): Map<string, Route> {
        return this._routes
    }

    add(route: Route): this {
        const key = this.getKey(route)
        const previous = this._routes.get(key)
        if (previous) this.remove(previous)

        if (!route.order || route.order === 0) {
            // Routes created outside Router (legacy callers) still receive a
            // stable insertion order for tie-breaking.
            (route as any).order = ++this._order
        } else {
            this._order = Math.max(this._order, route.order)
        }

        this._routes.set(key, route)

        if (route.isStatic) {
            this._static.set(key, route)
            return this
        }

        let node = this._tries.get(route.method)
        if (!node) {
            node = createNode()
            this._tries.set(route.method, node)
        }

        for (const segment of route.segments) {
            if (segment.startsWith(':') && segment.length > 1) {
                node = node.param ??= createNode()
            } else {
                let child = node.static.get(segment)
                if (!child) {
                    child = createNode()
                    node.static.set(segment, child)
                }
                node = child
            }
        }

        node.routes.push(route)
        return this
    }

    has(route: Route): boolean {
        return this._routes.has(this.getKey(route))
    }

    find(route: Route): Route | undefined {
        return this._routes.get(this.getKey(route))
    }

    replace(route: Route): this {
        const key = this.getKey(route)
        const previous = this._routes.get(key)
        if (previous) this.remove(previous)
        return this.add(route)
    }

    upsert(route: Route): this {
        return this.replace(route)
    }

    remove(route: Route): this {
        const key = this.getKey(route)
        const registered = this._routes.get(key)
        if (!registered) return this

        this._routes.delete(key)
        this._static.delete(key)

        if (registered.isStatic || !registered.segments.length) return this

        const root = this._tries.get(registered.method)
        if (!root) return this

        this.removeFromTrie(root, registered.segments, 0, registered)

        if (!root.routes.length && !root.param && !root.static.size) {
            this._tries.delete(registered.method)
        }

        return this
    }

    protected removeFromTrie(node: TrieNode, segments: readonly string[], index: number, route: Route): boolean {
        if (index === segments.length) {
            const position = node.routes.indexOf(route)
            if (position !== -1) node.routes.splice(position, 1)
        } else {
            const segment = segments[index]
            if (segment.startsWith(':') && segment.length > 1) {
                if (node.param && this.removeFromTrie(node.param, segments, index + 1, route)) {
                    if (!node.param.routes.length && !node.param.param && !node.param.static.size) {
                        node.param = undefined
                    }
                }
            } else {
                const child = node.static.get(segment)
                if (child && this.removeFromTrie(child, segments, index + 1, route)) {
                    if (!child.routes.length && !child.param && !child.static.size) {
                        node.static.delete(segment)
                    }
                }
            }
        }

        return !node.routes.length && !node.param && !node.static.size
    }

    /**
     * Résout une requête sans muter la `Route` : les paramètres sont propres à
     * l'appel et peuvent être conservés par le contexte de la requête.
     */
    resolve(method: string, url: string): RouteResolution | null {
        const path = normalizeRoutePath(url)
        const staticRoute = this._static.get(`${method}:${path}`)
        if (staticRoute) return {route: staticRoute, params: EMPTY_PARAMS}

        const root = this._tries.get(method)
        if (!root) return null

        const segments = path === '/' ? EMPTY_SEGMENTS : path.slice(1).split('/')
        const candidates: RouteCandidate[] = []
        const values: string[] = []
        this.collect(root, segments, 0, values, candidates)

        if (!candidates.length) return null

        let best = candidates[0]
        for (let index = 1; index < candidates.length; index++) {
            const candidate = candidates[index]
            const candidateCount = candidate.route.paramNames.length
            const bestCount = best.route.paramNames.length
            if (candidateCount < bestCount) {
                best = candidate
            } else if (candidateCount === bestCount && candidate.route.order < best.route.order) {
                best = candidate
            }
        }

        if (!best.route.paramNames.length) return {route: best.route, params: EMPTY_PARAMS}

        const params: Record<string, string> = {}
        for (let index = 0; index < best.route.paramNames.length; index++) {
            params[best.route.paramNames[index]] = best.values[index] ?? ''
        }

        return {route: best.route, params}
    }

    protected collect(
        node: TrieNode,
        segments: readonly string[],
        index: number,
        values: string[],
        candidates: RouteCandidate[],
    ): void {
        if (index === segments.length) {
            for (const route of node.routes) {
                candidates.push({route, values: [...values]})
            }
            return
        }

        const segment = segments[index]
        const staticChild = node.static.get(segment)
        if (staticChild) this.collect(staticChild, segments, index + 1, values, candidates)

        if (node.param) {
            values.push(segment)
            this.collect(node.param, segments, index + 1, values, candidates)
            values.pop()
        }
    }

    /** Compatibilité : renvoie la route sans exposer les paramètres. */
    match(method: string, url: string): Route | null {
        return this.resolve(method, url)?.route ?? null
    }

    clear(): this {
        this._routes.clear()
        this._static.clear()
        this._tries.clear()
        this._order = 0
        return this
    }
}

const EMPTY_PARAMS: Record<string, string> = Object.freeze({}) as Record<string, string>
const EMPTY_SEGMENTS: readonly string[] = Object.freeze([])
