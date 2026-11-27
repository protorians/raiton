import { MiddlewareType } from '../../types/index.ts'
import { middlewareCompose, middlewareComposeWithTerminal } from '../middleware/compose.ts'

export class MiddlewarePipeline {
    private stack: MiddlewareType[] = []
    private compiled?: ReturnType<typeof middlewareCompose>
    private terminalRunner?: ReturnType<typeof middlewareComposeWithTerminal>

    private invalidate(): void {
        this.compiled = undefined
        this.terminalRunner = undefined
    }

    use(mw: MiddlewareType): this {
        this.stack.push(mw)
        this.invalidate()
        return this;
    }

    /** True when this exact middleware instance/function is already mounted. */
    has(mw: MiddlewareType): boolean {
        return this.stack.includes(mw)
    }

    /** True when a middleware with this name is already mounted. */
    hasName(name: string): boolean {
        const normalized = name.toLowerCase()
        return this.stack.some(entry => {
            if (typeof entry === 'function') return entry.name?.toLowerCase() === normalized
            if (typeof entry === 'object' && entry !== null && 'name' in entry)
                return String((entry as any).name).toLowerCase() === normalized
            return false
        })
    }

    /** Snapshot used by diagnostics and tests. */
    entries(): readonly MiddlewareType[] {
        return this.stack
    }

    replace(name: string, mw: MiddlewareType): this {
        const normalized = name.toLowerCase()
        for (let i = 0; i < this.stack.length; i++) {
            const entry = this.stack[i]
            let entryName: string | undefined
            if (typeof entry === 'function') {
                entryName = entry.name?.toLowerCase()
            } else if (typeof entry === 'object' && entry !== null && 'name' in entry) {
                entryName = (entry as any).name?.toLowerCase()
            }
            if (entryName === normalized) {
                this.stack[i] = mw
                this.invalidate()
                return this
            }
        }
        this.stack.push(mw)
        this.invalidate()
        return this;
    }

    /**
     * Remove a middleware by stable name or by identity. Identity removal is
     * used by the artifact bridge when a descriptor name differs from the
     * middleware function name.
     */
    remove(nameOrMiddleware: string | MiddlewareType): this {
        if (typeof nameOrMiddleware !== 'string') {
            this.stack = this.stack.filter(entry => entry !== nameOrMiddleware)
            this.invalidate()
            return this
        }
        const normalized = nameOrMiddleware.toLowerCase()
        this.stack = this.stack.filter(entry => {
            if (typeof entry === 'function') return entry.name?.toLowerCase() !== normalized
            if (typeof entry === 'object' && entry !== null && 'name' in entry)
                return (entry as any).name?.toLowerCase() !== normalized
            return true
        })
        this.invalidate()
        return this;
    }

    clear(): this {
        this.stack = []
        this.invalidate()
        return this;
    }

    run(ctx: any, ...extra: MiddlewareType[]) {
        // Hot path: the application appends its route terminal. The stack is
        // precomposed and only the terminal is supplied per request.
        if (extra.length === 1 && typeof extra[0] === 'function') {
            this.terminalRunner ??= middlewareComposeWithTerminal(this.stack)
            return this.terminalRunner(ctx, extra[0])
        }

        if (extra.length === 0) {
            this.compiled ??= middlewareCompose(this.stack)
            return this.compiled(ctx)
        }

        return middlewareCompose([...this.stack, ...extra])(ctx)
    }
}
