import { MiddlewareType } from '../../types'
import { middlewareCompose } from '..'

export class MiddlewarePipeline {
  private stack: MiddlewareType[] = []

  use(mw: MiddlewareType): this {
    this.stack.push(mw)
    return this;
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
        return this
      }
    }
    this.stack.push(mw)
    return this;
  }

  remove(name: string): this {
    const normalized = name.toLowerCase()
    this.stack = this.stack.filter(entry => {
      if (typeof entry === 'function') return entry.name?.toLowerCase() !== normalized
      if (typeof entry === 'object' && entry !== null && 'name' in entry)
        return (entry as any).name?.toLowerCase() !== normalized
      return true
    })
    return this;
  }

  clear(): this {
    this.stack = []
    return this;
  }

  run(ctx: any, ...extra: MiddlewareType[]) {
    const fn = middlewareCompose([...this.stack, ...extra])
    return typeof fn == 'function' ? fn(ctx) : undefined;
  }
}
