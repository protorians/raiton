import {RequestContext} from "@/core/context";
import {HttpMethod} from "@/sdk";

export type RouteHandler = (ctx: RequestContext) => Promise<any> | any

export interface RouteDefinition {
    method: HttpMethod
    path: string
    version?: string
    handler: RouteHandler
}
