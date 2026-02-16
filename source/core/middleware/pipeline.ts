import { MiddlewareType } from '@/types'
import { middlewareCompose } from '@/core'

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

  run(ctx: any) {
    const fn = middlewareCompose(this.stack)
    return typeof fn == 'function' ? fn(ctx) : undefined;
  }

  clone() {
    const pipeline = new MiddlewarePipeline()
    pipeline.stack = [...this.stack]
    return pipeline
  }
}
