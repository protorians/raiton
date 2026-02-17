import {HttpMethod, Parametrable} from "@/sdk/enums";
import {Context} from "@/types/core";
import {MiddlewareCallable, MiddlewareType} from "@/types/middleware";

export interface ControllerMetaInterface {
    prefix?: string;
    routes: RouteMetaInterface[];
    middlewares: Record<string, MiddlewareCallable[]>;
}

export type ControllerDecoratorCallable = (metadata: ControllerMetaInterface) => void

export interface RouteMetaInterface {
    method: HttpMethod;
    path: string;
    propertyKey: string;
}

export interface ParamMetaInterface {
    index: number;
    type: Parametrable;
    key?: string;
    callable?: (ctx: Context) => any;
    metatype?: any;
}

export interface RouteDecoratorParameters {
    controller: ControllerMetaInterface;
    route: RouteMetaInterface;
    index: number;
}

export type RouteDecoratorCallable = (parameters: RouteDecoratorParameters) => void;
