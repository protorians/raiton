import {RequestContext} from "../core/context.ts";
import {HttpMethod} from "../framework/index.ts";

export type RouteHandlerCallable = (ctx: RequestContext) => Promise<any> | any

export interface RouteDefinitionInterface {
    method: HttpMethod
    path: string
    version?: string
    handler: RouteHandlerCallable
}

export interface RouteInteractionsSubscriber{
    target: Function;
    propertyKey: string;
}
