import {HookNameType, HookHandlerCallable} from '../types'

export class HookStore {
    private hooks = new Map<HookNameType, HookHandlerCallable[]>()

    add(name: HookNameType, handler: HookHandlerCallable) {
        const list = this.hooks.get(name) ?? []
        list.push(handler)
        this.hooks.set(name, list)
    }

    remove(name: HookNameType, handler?: HookHandlerCallable) {
        if (!this.hooks.has(name)) return
        if (!handler) {
            this.hooks.delete(name)
            return
        }
        const list = this.hooks.get(name)!
        const idx = list.indexOf(handler)
        if (idx !== -1) list.splice(idx, 1)
        if (list.length === 0) this.hooks.delete(name)
        else this.hooks.set(name, list)
    }

    replace(name: HookNameType, oldHandler: HookHandlerCallable, newHandler: HookHandlerCallable) {
        if (!this.hooks.has(name)) {
            this.add(name, newHandler)
            return
        }
        const list = this.hooks.get(name)!
        const idx = list.indexOf(oldHandler)
        if (idx !== -1) {
            list[idx] = newHandler
        } else {
            list.push(newHandler)
        }
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
