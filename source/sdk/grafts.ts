import type {IGraftDefinition, IConstructor, IDependencyContainer} from "@/types";
import {DependencyContainer} from "./dependency-container";
import {LifetimeEnum} from "@protorians/core";

export class GraftsRegistry {
    protected static _container: IDependencyContainer<IGraftDefinition, any> = new DependencyContainer<IGraftDefinition, any>('graft');

    static get container(): IDependencyContainer<IGraftDefinition, any> {
        return this._container;
    }

    static register(
        name: string,
        construct: IConstructor,
        lifetime: LifetimeEnum = LifetimeEnum.SINGLETON
    ): IDependencyContainer<IGraftDefinition, any> {
        return this._container.register(name, construct, lifetime);
    }

    static get<T>(name: string): T | undefined {
        return this._container.get(name);
    }

    static async imports(): Promise<string[]> {
        return this._container.imports();
    }
}

export const Grafts: IGlobalGrafts = new Proxy({}, {
    get(_, prop: string) {
        return GraftsRegistry.get(prop);
    }
}) as any;