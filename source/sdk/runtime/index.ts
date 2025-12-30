import type {RuntimeAdapter, RuntimeHandlerCallable, RuntimeInterface, RuntimeServer} from "@/types";
import {RuntimeType} from "@/sdk/enums/runtime.enum";
import {nodeRuntime} from "@/sdk/runtime/node/server";
import {bunRuntime} from "@/sdk/runtime/bun/server";
import {denoRuntime} from "@/sdk/runtime/deno/server";
import {webRuntime} from "@/sdk/runtime/web/server";


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

    get isWeb(): boolean {
        return this.type === RuntimeType.Web;
    }

    get isBun(): boolean {
        return this.type === RuntimeType.Bun;
    }

    adapter(): RuntimeAdapter {
        switch (this.type) {
            case RuntimeType.Node:
                return nodeRuntime
            case RuntimeType.Bun:
                return bunRuntime
            case RuntimeType.Deno:
                return denoRuntime
            case RuntimeType.Web:
                return webRuntime
        }
    }

    createServer(handler: RuntimeHandlerCallable): RuntimeServer {
        return this.adapter().createServer(handler)
    }
}