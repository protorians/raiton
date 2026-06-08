import {RequestContext} from "../core/context";
import {HttpMethod} from "../sdk";

export type RouteHandlerCallable = (ctx: RequestContext) => Promise<any> | any

export interface RouteDefinitionInterface {
    method: HttpMethod
    path: string
    version?: string
    handler: RouteHandlerCallable
}
