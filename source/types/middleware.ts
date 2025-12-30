import {RequestContext} from "@/core/context";


export type Next = () => Promise<void>

export type MiddlewareStepped = {
    setup: any,
    name: string;
}

export type Middleware = ((
    ctx: RequestContext,
    next: Next
) => Promise<any> | void) | MiddlewareStepped
