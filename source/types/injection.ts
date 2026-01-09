import {IConstructor} from "@/types/contruct";
import {LifetimeEnum} from "@protorians/core";


export interface ContainerDefinitionInterface<T = any> {
    name: string;
    construct: IConstructor<T>;
    lifetime: LifetimeEnum;
    instance?: any;
    scope?: Symbol;
    parameters?: any[];
}
