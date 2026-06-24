import {HookNameType, HookHandlerCallable} from '../types'

export class HookStore {
    private hooks = new Map<HookNameType, HookHandlerCallable[]>()

    add(name: HookNameType, handler: HookHandlerCallable) {
        const list = this.hooks.get(name) ?? []
        list.push(handler)
        this.hooks.set(name, list)
    }

    async run(name: HookNameType, ctx: any) {
        const list = this.hooks.get(name)
        if (!list) return

        for (const hook of list) {
            await hook(ctx)
        }
    }
}
