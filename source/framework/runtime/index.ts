import type {
    RuntimeAdapterInterface,
    RuntimeHandlerCallable,
    RuntimeInterface,
    RuntimeServerInterface,
    RuntimeServerOptionsInterface
} from "../../types/index.ts";
import {RuntimeType} from "../enums/runtime.enum.ts";

/**
 * Adapters are loaded lazily. Importing the framework entry must not pull the
 * Node, Bun *and* Deno adapters at once: only the active runtime is loaded
 * eagerly, and `prepare()` can load another one when a project explicitly
 * selects it.
 */
const adapters: Record<RuntimeType, () => Promise<RuntimeAdapterInterface>> = {
    [RuntimeType.Node]: () => import("./node/server.ts").then(module => module.nodeRuntime),
    [RuntimeType.Bun]: () => import("./bun/server.ts").then(module => module.bunRuntime),
    [RuntimeType.Deno]: () => import("./deno/server.ts").then(module => module.denoRuntime),
}

function currentRuntimeType(): RuntimeType {
    if (typeof Bun !== 'undefined') return RuntimeType.Bun
    if (typeof Deno !== 'undefined') return RuntimeType.Deno
    return RuntimeType.Node
}

const eagerType = currentRuntimeType()
const eagerAdapter = await adapters[eagerType]()

export class Runtime implements RuntimeInterface {
    private adapterInstance?: RuntimeAdapterInterface

    constructor(
        public readonly type: RuntimeType = eagerType
    ) {
        if (type === eagerType) this.adapterInstance = eagerAdapter
    }

    get isNode(): boolean {
        return this.type === RuntimeType.Node;
    }

    get isDeno(): boolean {
        return this.type === RuntimeType.Deno;
    }

    get isBun(): boolean {
        return this.type === RuntimeType.Bun;
    }

    get ready(): boolean {
        return Boolean(this.adapterInstance)
    }

    /**
     * Loads the adapter for `type`. Safe to call several times.
     */
    async prepare(): Promise<this> {
        if (!this.adapterInstance) {
            this.adapterInstance = await adapters[this.type]()
        }
        return this
    }

    adapter(): RuntimeAdapterInterface {
        if (!this.adapterInstance) {
            throw new Error(
                `Runtime adapter "${this.type}" is not loaded. ` +
                `Call \`await runtime.prepare()\` before creating a server.`
            )
        }
        return this.adapterInstance
    }

    createServer(handler: RuntimeHandlerCallable, options?: RuntimeServerOptionsInterface): RuntimeServerInterface {
        return this.adapter().createServer(handler, options)
    }
}
