import {RequestContext} from "../core/context";


export type MiddlewareNextCallable = () => Promise<void>

export interface MiddlewareSetupInterface {
    setup: any,
    name: string;
}

export interface MiddlewareParametersInterface {
    context: RequestContext;
    next: MiddlewareNextCallable;
}

export type MiddlewareCallable = (parameters: MiddlewareParametersInterface) => Promise<any> | void

export type MiddlewareType = MiddlewareCallable | MiddlewareSetupInterface
