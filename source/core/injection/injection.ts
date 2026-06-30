import "reflect-metadata";
import type {ConstructorType, ContainerDefinitionInterface} from "../../types";
import {LifetimeEnum, TextUtility} from "@protorians/core";
import {Logger} from "@protorians/logger";
import {METADATA_KEYS} from "../../framework/constants";
import {Throwable} from "../../framework/exceptions";

const camelCase = TextUtility.camelCase;

export class Injection {

    protected static _classes: Map<string, ContainerDefinitionInterface> = new Map();
    protected static _instances: Map<string, Map<any, any>> = new Map();
    protected static _resolutionStack: string[] = [];
    protected static _dependents: Map<string, Set<string>> = new Map();
    protected static _artifactPaths: Map<string, string> = new Map();

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
        Logger.error('Clearing injection container');
        this._classes.clear();
        this._instances.clear();
        this._dependents.clear();
        this._artifactPaths.clear();
    }

    protected static normalizeName(name: string): string {
        const stableName = camelCase(name);
        return stableName[0].toLowerCase() + stableName.slice(1);
    }

    static registry(
        name: string,
        construct: ConstructorType,
        lifetime: LifetimeEnum = LifetimeEnum.SINGLETON,
        scope?: Symbol
    ): typeof this {
        if (!construct.name)
            throw new Error('Le constructeur doit avoir un nom valide pour être enregistré dans le conteneur.');

        this._classes.set(this.normalizeName(name), {name, construct, lifetime, scope});
        return this;
    }

    static updateConstruct(name: string, construct: ConstructorType): typeof this {
        const name_ = this.normalizeName(name);
        this._classes.set(name_, {...this._classes.get(this.normalizeName(name))!, construct});
        return this;
    }

    static getDependents(name: string): string[] {
        return Array.from(this._dependents.get(this.normalizeName(name)) || []);
    }

    static registerArtifactPath(name: string, path: string): typeof this {
        this._artifactPaths.set(this.normalizeName(name), path);
        return this;
    }

    static getArtifactPath(name: string): string | undefined {
        return this._artifactPaths.get(this.normalizeName(name));
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
                        this.addDependent(token, definition.name);
                        args.push(this.get(token, effectiveScope));
                        continue;
                    }
                    if (typeof param === 'function') {
                        const metadata: ContainerDefinitionInterface = Reflect.getMetadata(METADATA_KEYS.CONTAINER, param);
                        const token = metadata?.name || param.name;
                        this.addDependent(token, definition.name);
                        args.push(this.get(token, effectiveScope));
                        continue;
                    }
                }

                if (designParam && typeof designParam === 'function' && designParam.name) {
                    const metadata: ContainerDefinitionInterface = Reflect.getMetadata(METADATA_KEYS.CONTAINER, designParam);
                    const token = metadata?.name || designParam.name;
                    this.addDependent(token, definition.name);
                    args.push(this.get(token, effectiveScope));
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

    protected static addDependent(dependencyName: string, dependentName: string) {
        const dep = this.normalizeName(dependencyName);
        if (!this._dependents.has(dep)) {
            this._dependents.set(dep, new Set());
        }
        this._dependents.get(dep)!.add(this.normalizeName(dependentName));
    }

    static get<T>(name: string, scope?: Symbol): T | undefined {
        const name_ = this.normalizeName(name);
        const cls = this._classes.get(name_);
        if (!cls) throw new Throwable(`Dependency ${name_} not registered`);

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
                    this.triggerLifecycle(instance);
                }
                return scopeInstances.get(effectiveScope);
            }

            if (cls.lifetime === LifetimeEnum.TRANSIENT) {
                instance = new cls.construct(...this.resolveArguments(cls, effectiveScope));
                this.injectProperties(instance, cls, effectiveScope);
                this.triggerLifecycle(instance);
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
                    this.addDependent(token, definition.name);
                    instance[propertyKey] = this.get(token, scope);
                } else if (typeof type === 'function') {
                    const metadata: ContainerDefinitionInterface = Reflect.getMetadata(METADATA_KEYS.CONTAINER, type);
                    const token_ = metadata?.name || type.name;
                    this.addDependent(token_, definition.name);
                    instance[propertyKey] = this.get(token_, scope);
                }
            }
        }
    }

    protected static triggerLifecycle(instance: any): void {
        if (typeof instance.onInit === 'function') {
            instance.onInit();
        }
        if (typeof instance.onMount === 'function') {
            instance.onMount();
        }
    }

    static async shutdown(): Promise<void> {
        for (const scopeInstances of this._instances.values()) {
            for (const instance of scopeInstances.values()) {
                if (typeof instance.onUnmount === 'function') {
                    await instance.onUnmount();
                }
            }
        }
        this.clear();
    }

    static resolve<T>(construct: ConstructorType<T>): T {
        const metadata: ContainerDefinitionInterface = Reflect.getMetadata(METADATA_KEYS.CONTAINER, construct);
        const name = metadata?.name || ('constructor' in construct ? construct.constructor.name || false : false) || construct.name;

        if (!metadata) {
            if (typeof name === 'undefined') Logger.debug('Cannot resolve', construct);
            throw new Throwable(`Cannot resolve ${name} as dependency`);
        }

        return this.get(name) as T;
    }
}