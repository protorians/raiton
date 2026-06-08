import {IConstructor} from "./contruct";
import {LifetimeEnum} from "@protorians/core";


export interface ContainerDefinitionInterface<T = any> {
    name: string;
    construct: IConstructor<T>;
    lifetime: LifetimeEnum;
    instance?: any;
    scope?: Symbol;
    parameters?: any[];
    properties?: Map<string | symbol, any>;
}
