import {RequestContext} from "@/core/context";


export type NextCallable = () => Promise<void>

export interface MiddlewareSetupInterface {
    setup: any,
    name: string;
}

export interface MiddlewareParameters {
    context: RequestContext;
    next: NextCallable;
}

export type MiddlewareCallable = (parameters: MiddlewareParameters) => Promise<any> | void

export type MiddlewareType = MiddlewareCallable | MiddlewareSetupInterface
