import {HttpMethod, Parametrable} from "@/sdk/enums";
import {Context} from "@/types/core";

export interface ControllerMeta {
    prefix?: string
    routes: RouteMeta[]
}

export interface RouteMeta {
    method: HttpMethod
    path: string
    propertyKey: string
    params: ParamMeta[]
}

export interface ParamMeta {
    index: number
    type: Parametrable
    key?: string
    callable?: (ctx: Context) => any
}
