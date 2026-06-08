import {HttpMethod, Parametrable} from "../sdk/enums";
import {ContextInterface} from "./core";
import {MiddlewareCallable, MiddlewareType} from "./middleware";

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
    callable?: (ctx: ContextInterface) => any;
    metatype?: any;
}

export interface RouteDecoratorParametersInterface {
    controller: ControllerMetaInterface;
    route: RouteMetaInterface;
    index: number;
}

export type RouteDecoratorCallable = (parameters: RouteDecoratorParametersInterface) => void;
