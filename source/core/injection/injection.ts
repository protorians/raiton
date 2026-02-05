import "reflect-metadata";
import type {IConstructor, ContainerDefinitionInterface} from "@/types";
import {Throwable} from "@/sdk/throwable";
import {LifetimeEnum, TextUtility} from "@protorians/core";
import {Logger} from "@protorians/logger";
import {METADATA_KEYS} from "@/sdk/constants";
import camelCase = TextUtility.camelCase;

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
        return this._classes.has(this.normalizeName(name));
    }

    static clear(): void {
        this._classes.clear();
        this._instances.clear();
    }

    static normalizeName(name: string): string {
        const stableName = camelCase(name);
        return stableName[0].toLowerCase() + stableName.slice(1);
    }

    static registry(
        name: string,
        construct: IConstructor,
        lifetime: LifetimeEnum = LifetimeEnum.SINGLETON,
        scope?: Symbol
    ): typeof this {
        if (!construct.name)
            throw new Error('Le constructeur doit avoir un nom valide pour être enregistré dans le conteneur.');

        this._classes.set(this.normalizeName(name), {name, construct, lifetime, scope});
        return this;
    }

    static resolveArguments(definition: ContainerDefinitionInterface, scope?: any): any[] {
        try {
            const parameters = Reflect.getMetadata(METADATA_KEYS.INJECT_PARAMETERS, definition.construct) || [];
            const designParameters = Reflect.getMetadata('design:paramtypes', definition.construct) || [];
            const effectiveScope = scope || definition.scope || this.defaultScope;

            const maxLen = Math.max(parameters.length, designParameters.length);
            const args = [];

            for (let i = 0; i < maxLen; i++) {
                const param = parameters[i];
                const designParam = designParameters[i];

                if (param && param !== true) {
                    const token = typeof param === 'function' ? (param.name || param) : param;
                    if (typeof token === 'string') {
                        args.push(this.get(token, effectiveScope));
                        continue;
                    }
                    if (typeof param === 'function') {
                        const metadata: ContainerDefinitionInterface = Reflect.getMetadata(METADATA_KEYS.CONTAINER, param);
                        args.push(this.get(metadata?.name || param.name, effectiveScope));
                        continue;
                    }
                }

                if (designParam && typeof designParam === 'function' && designParam.name) {
                    const metadata: ContainerDefinitionInterface = Reflect.getMetadata(METADATA_KEYS.CONTAINER, designParam);
                    args.push(this.get(metadata?.name || designParam.name, effectiveScope));
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
        const name_ = this.normalizeName(name);
        const cls = this._classes.get(name_);
        if (!cls) throw new Throwable(`Dependency ${name} not registered`);

        const effectiveScope = scope || cls.scope || this.defaultScope;
        if (this._resolutionStack.includes(name_)) {
            throw new Throwable(`Circular dependency detected: ${this._resolutionStack.join(' -> ')} -> ${name}`);
        }

        this._resolutionStack.push(name_);

        try {
            let instance: any;
            if (cls.lifetime === LifetimeEnum.SINGLETON) {
                if (!this._instances.has(name_)) {
                    this._instances.set(name_, new Map());
                }
                const scopeInstances = this._instances.get(name_)!;

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
        const properties: Map<string | symbol, any> = Reflect.getMetadata(METADATA_KEYS.INJECT_PROPERTIES, definition.construct);

        if (properties) {
            for (const [propertyKey, type] of properties) {
                const token = typeof type === 'function' ? (type.name || type) : type;
                if (typeof token === 'string') {
                    instance[propertyKey] = this.get(token, scope);
                } else if (typeof type === 'function') {
                    const metadata: ContainerDefinitionInterface = Reflect.getMetadata(METADATA_KEYS.CONTAINER, type);
                    instance[propertyKey] = this.get(metadata?.name || type.name, scope);
                }
            }
        }
    }

    static resolve<T>(construct: IConstructor<T>): T {
        const metadata: ContainerDefinitionInterface = Reflect.getMetadata(METADATA_KEYS.CONTAINER, construct);

        if (!metadata)
            throw new Throwable(`Cannot resolve ${construct.name} as dependency`);

        return this.get(metadata.name) as T;
    }
}