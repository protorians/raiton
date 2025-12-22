import {IConstructor} from "./contruct";
import {LifetimeEnum} from "@protorians/core";

export interface IDependencyContainerDefinition<T = any> {
    name: string;
    construct: IConstructor<T>;
    lifetime: LifetimeEnum;
    instance?: any;
}


export interface IDependencyContainer<T extends IDependencyContainerDefinition<E>, E = any> {
    readonly artifact: string;

    get classes(): Map<string, T>;

    get instances(): Map<string, E>;

    register(name: string, construct: IConstructor<E>, lifetime: LifetimeEnum): this;

    resolveArguments(definition: T): any[];

    get<T>(name: string): T | undefined;

    imports(): Promise<string[]>;
}