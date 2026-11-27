import type {RouteDefinitionInterface} from '../../types/router.ts'

/**
 * Normalise un chemin de route : slash initial, pas de slashs doublés, pas de
 * slash final (sauf pour la racine).
 */
export function normalizeRoutePath(value: string): string {
    let path = value || '/'
    if (!path.startsWith('/')) path = `/${path}`
    path = path.replace(/\/+/g, '/')
    if (path.length > 1) path = path.replace(/\/+$/, '')
    return path || '/'
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Une route compilée une seule fois à l'enregistrement.
 *
 * Les motifs (`regex`, segments, noms de paramètres) sont calculés dans le
 * constructeur : aucun travail de compilation n'est effectué pendant le
 * traitement d'une requête. Les paramètres extraits sont renvoyés dans un objet
 * neuf, jamais stockés sur l'instance partagée.
 */
export class Route {
    method: string
    path: string
    version?: string
    handler: RouteDefinitionInterface['handler']

    /** Chemin complet normalisé (version incluse). */
    readonly fullPath: string
    /** Segments du chemin complet, sans segment vide. */
    readonly segments: readonly string[]
    /** Noms des paramètres, dans l'ordre du chemin. */
    readonly paramNames: readonly string[]
    /** Vrai lorsqu'aucun segment paramétrique n'est présent. */
    readonly isStatic: boolean
    /** Motif compilé pour les routes paramétriques. */
    readonly pattern?: RegExp
    /** Ordre d'enregistrement (départage à spécificité égale). */
    readonly order: number

    /**
     * Conservé pour compatibilité : plus jamais muté par le matching.
     * Utilisez `Router.resolve()` / `Route.extractParams()` pour obtenir les
     * paramètres propres à une requête.
     */
    parameters: Record<string, string> = {}

    constructor(def: RouteDefinitionInterface, order = 0) {
        this.method = def.method
        this.path = def.path
        this.version = def.version
        this.handler = def.handler
        this.order = order

        const fullPath = normalizeRoutePath(this.version ? `/${this.version}${this.path}` : this.path)
        this.fullPath = fullPath
        this.segments = fullPath === '/' ? [] : fullPath.slice(1).split('/')

        const names: string[] = []
        let isStatic = true
        let pattern = ''

        for (const segment of this.segments) {
            if (segment.startsWith(':') && segment.length > 1) {
                names.push(segment.slice(1))
                pattern += '/([^/]+)'
                isStatic = false
            } else {
                pattern += `/${escapeRegExp(segment)}`
            }
        }

        this.paramNames = names
        this.isStatic = isStatic
        this.pattern = isStatic ? undefined : new RegExp(`^${pattern || '/'}$`)
    }

    /** @deprecated Conservé pour compatibilité ; les noms sont précompilés. */
    get params(): string[] {
        return [...this.paramNames]
    }

    get name(): string {
        return this.handler.name
    }

    /**
     * Compatibilité : renvoie une vue de la route portant les paramètres
     * extraits. L'instance partagée n'est jamais mutée.
     */
    extractParams(url: string): this {
        if (this.isStatic) return this

        const params = this.extractParamsFromPath(normalizeRoutePath(url))
        if (!params) return this

        return Object.assign(Object.create(this), {parameters: params}) as this
    }

    /** Extrait les paramètres d'un chemin déjà normalisé. */
    extractParamsFromPath(path: string): Record<string, string> | null {
        if (this.isStatic || !this.pattern) {
            return path === this.fullPath ? {} : null
        }

        const matches = this.pattern.exec(path)
        if (!matches) return null

        const params: Record<string, string> = {}
        for (let index = 0; index < this.paramNames.length; index++) {
            params[this.paramNames[index]] = matches[index + 1]
        }
        return params
    }

    /** Vrai si la route correspond au chemin, quelle que soit la méthode. */
    matchesPath(url: string): boolean {
        const path = normalizeRoutePath(url)
        if (this.isStatic) return this.fullPath === path
        return Boolean(this.pattern?.test(path))
    }

    match(method: string, url: string): boolean {
        if (method !== this.method) return false
        return this.matchesPath(url)
    }
}
