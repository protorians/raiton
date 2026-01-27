import type {IConstructor, ContainerDefinitionInterface} from "@/types";
import {Throwable} from "@/sdk/throwable";
import {LifetimeEnum} from "@protorians/core";
import {Logger} from "@protorians/logger";
import {getContainerMetadata} from "@/core/injection/metadata";
import "reflect-metadata";

export class Injection {

    protected static _classes: Map<string, ContainerDefinitionInterface> = new Map();
    protected static _instances: Map<string, Map<any, any>> = new Map();
    protected static _resolutionStack: string[] = [];

    static get classes(): Map<string, ContainerDefinitionInterface> {
        return this._classes;
    }

    static defaultScope = Symbol('default');

    static get instances(): Map<string, Map<any, any>> {
        return this._instances;
    }

    static has(name: string): boolean {
        return this._classes.has(name);
    }

    static clear(): void {
        this._classes.clear();
        this._instances.clear();
    }

    static registry(
        name: string,
        construct: IConstructor,
        lifetime: LifetimeEnum = LifetimeEnum.SINGLETON,
        scope?: Symbol
    ): typeof this {
        this._classes.set(name, {name, construct, lifetime, scope});
        return this;
    }

    static resolveArguments(definition: ContainerDefinitionInterface, scope?: any): any[] {
        try {
            const metadata: ContainerDefinitionInterface = getContainerMetadata(definition.construct);
            const parameters = metadata.parameters || [];
            const designParameters = Reflect.getMetadata('design:paramtypes', definition.construct) || [];
            const effectiveScope = scope || definition.scope || this.defaultScope;

            const maxLen = Math.max(parameters.length, designParameters.length);
            const args = [];

            for (let i = 0; i < maxLen; i++) {
                const param = parameters[i];
                const designParam = designParameters[i];

                if (typeof param === 'string') {
                    args.push(this.get(param, effectiveScope));
                    continue;
                }

                if (designParam && typeof designParam === 'function' && designParam.name) {
                    args.push(this.get(designParam.name, effectiveScope));
                    continue;
                }

                args.push(undefined);
            }
            return args;
        } catch (e) {
            Logger.error('Resolve', e);
            return [];
        }
    }

    static get<T>(name: string, scope?: Symbol): T | undefined {
        const cls = this._classes.get(name);
        if (!cls) throw new Throwable(`Dependency ${name} not registered`);

        const effectiveScope = scope || cls.scope || this.defaultScope;
        if (this._resolutionStack.includes(name)) {
            throw new Throwable(`Circular dependency detected: ${this._resolutionStack.join(' -> ')} -> ${name}`);
        }

        this._resolutionStack.push(name);

        try {
            let instance: any;
            if (cls.lifetime === LifetimeEnum.SINGLETON) {
                if (!this._instances.has(name)) {
                    this._instances.set(name, new Map());
                }
                const scopeInstances = this._instances.get(name)!;

                if (!scopeInstances.has(effectiveScope)) {
                    instance = new cls.construct(...this.resolveArguments(cls, effectiveScope));
                    scopeInstances.set(effectiveScope, instance);
                    this.injectProperties(instance, cls, effectiveScope);
                }
                return scopeInstances.get(effectiveScope);
            }

            if (cls.lifetime === LifetimeEnum.TRANSIENT) {
                instance = new cls.construct(...this.resolveArguments(cls, effectiveScope));
                this.injectProperties(instance, cls, effectiveScope);
                return instance as any;
            }
        } finally {
            this._resolutionStack.pop();
        }

        return undefined;
    }

    protected static injectProperties(instance: any, definition: ContainerDefinitionInterface, scope?: any): void {
        const metadata: ContainerDefinitionInterface = getContainerMetadata(definition.construct);
        if (metadata.properties) {
            for (const [propertyKey, type] of metadata.properties) {
                if (type && type.name) {
                    instance[propertyKey] = this.get(type.name, scope);
                }
            }
        }
    }

    static resolve<T>(construct: IConstructor<T>): T {
        const metadata = getContainerMetadata(construct);

        if(!metadata)
            throw new Throwable(`Cannot resolve ${construct.name} as dependency`);

        return this.get(metadata.name) as T;
    }
}