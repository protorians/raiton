import type {
    RuntimeAdapterInterface,
    RuntimeHandlerCallable,
    RuntimeInterface,
    RuntimeServerInterface,
    RuntimeServerOptionsInterface
} from "../../types/index.ts";
import {RuntimeType} from "../enums/runtime.enum.ts";
import {nodeRuntime} from "./node/server.ts";
import {bunRuntime} from "./bun/server.ts";
import {denoRuntime} from "./deno/server.ts";
// import {webRuntime} from "./web/server.ts";


export class Runtime implements RuntimeInterface {
    constructor(
        public readonly type: RuntimeType = RuntimeType.Node
    ) {
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

    adapter(): RuntimeAdapterInterface {
        switch (this.type) {
            case RuntimeType.Node:
                return nodeRuntime
            case RuntimeType.Bun:
                return bunRuntime
            case RuntimeType.Deno:
                return denoRuntime
        }
    }

    createServer(handler: RuntimeHandlerCallable, options?: RuntimeServerOptionsInterface): RuntimeServerInterface {
        return this.adapter().createServer(handler, options)
    }
}