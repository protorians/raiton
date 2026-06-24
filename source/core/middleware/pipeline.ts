import { MiddlewareType } from '../../types'
import { middlewareCompose } from '..'

export class MiddlewarePipeline {
  private stack: MiddlewareType[] = []

  use(mw: MiddlewareType): this {
    this.stack.push(mw)
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
