import {ConstructorType} from "./contruct.ts";
import {LifetimeEnum} from "@protorians/core";


export interface ContainerDefinitionInterface<T = any> {
    name: string;
    construct: ConstructorType<T>;
    lifetime: LifetimeEnum;
    instance?: any;
    scope?: Symbol;
    parameters?: any[];
    properties?: Map<string | symbol, any>;
}
