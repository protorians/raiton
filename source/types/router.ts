import {RequestContext} from "../core/context";
import {HttpMethod} from "../framework";

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
