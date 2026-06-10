import type {RuntimeAdapterInterface, RuntimeHandlerCallable, RuntimeInterface, RuntimeServerInterface} from "../../types";
import {RuntimeType} from "../enums/runtime.enum";
import {nodeRuntime} from "./node/server";
import {bunRuntime} from "./bun/server";
import {denoRuntime} from "./deno/server";
import {webRuntime} from "./web/server";


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

    adapter(): RuntimeAdapterInterface {
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

    createServer(handler: RuntimeHandlerCallable): RuntimeServerInterface {
        return this.adapter().createServer(handler)
    }
}