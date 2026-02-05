import type {RouteDefinition} from '@/types/router'

export class Route {
    method: string
    path: string
    version?: string
    handler: RouteDefinition['handler']
    parameters: Record<string, string> = {}

    constructor(def: RouteDefinition) {
        this.method = def.method
        this.path = def.path
        this.version = def.version
        this.handler = def.handler
    }

    get params(): string[] {
        const fullPath = this.version ? `/${this.version}${this.path}` : this.path
        const matches = fullPath.match(/:[a-zA-Z0-9_]+/g)
        return matches ? matches.map(m => m.substring(1)) : []
    }

    get name(): string {
        return this.handler.name
    }

    extractParams(url: string): this {
        const fullPath = (this.version ? `/${this.version}${this.path}` : this.path)
            .replace(/\/+$/, '')
        const paramNames = this.params
        if (paramNames.length === 0) return this

        const regexPath = fullPath.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)')
        const regex = new RegExp(`^${regexPath || '/'}/?$`)
        const matches = url.match(regex)

        if (matches) {
            const params: Record<string, string> = {}
            paramNames.forEach((name, index) => {
                params[name] = matches[index + 1]
            })
            this.parameters = params
        }

        return this
    }

    match(method: string, url: string): boolean {
        if (method !== this.method) return false

        const fullPath = (this.version ? `/${this.version}${this.path}` : this.path)
            .replace(/\/+$/, '')
        const cleanUrl = url.replace(/\/+$/, '')

        if (!fullPath.includes(':')) {
            return (fullPath || '/') === (cleanUrl || '/')
        }

        const regexPath = fullPath.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)')
        const regex = new RegExp(`^${regexPath || '/'}/?$`)
        return regex.test(url)
    }
}
