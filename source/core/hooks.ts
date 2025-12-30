import {HookName, HookHandler} from '@/types'

export class HookStore {
    private hooks = new Map<HookName, HookHandler[]>()

    add(name: HookName, handler: HookHandler) {
        const list = this.hooks.get(name) ?? []
        list.push(handler)
        this.hooks.set(name, list)
    }

    async run(name: HookName, ctx: any) {
        const list = this.hooks.get(name)
        if (!list) return

        for (const hook of list) {
            await hook(ctx)
        }
    }

    clone() {
        const store = new HookStore()
        for (const [key, value] of this.hooks) {
            store.hooks.set(key, [...value])
        }
        return store
    }
}
