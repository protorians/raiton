import { Middleware } from '@/types'
import { compose } from './compose'
import {Logger} from "@protorians/logger";

export class MiddlewarePipeline {
  private stack: Middleware[] = []

  use(mw: Middleware): this {
    this.stack.push(mw)
    return this;
  }

  clear(): this {
    this.stack = []
    return this;
  }

  run(ctx: any) {
    const fn = compose(this.stack)
    return typeof fn == 'function' ? fn(ctx) : undefined;
  }

  clone() {
    const pipeline = new MiddlewarePipeline()
    pipeline.stack = [...this.stack]
    return pipeline
  }
}
