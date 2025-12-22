import {IDependencyContainer, IDependencyContainerDefinition, IConstructor} from "@/types";
import {Logger} from "@protorians/logger";
import {SYSTEM_DECORATORS_KEYS} from "@/sdk/constants";
import {LifetimeEnum} from "@protorians/core";
import {Throwable} from "@/sdk/throwable";
import {ArtifactFactory} from "@/sdk/artifacts";


export class DependencyContainer<T extends IDependencyContainerDefinition<E>, E = any> implements IDependencyContainer<T, E> {

    protected _classes: Map<string, T> = new Map();
    protected _instances: Map<string, E> = new Map();
    protected _extensions: string[] = ['ts', 'js', 'mjs', 'cjs'];

    constructor(public readonly artifact: string,) {
        if (!artifact) throw new Throwable('Artifact name is required for DependencyContainer');
    }

    get classes(): Map<string, T> {
        return this._classes;
    }

    get instances(): Map<string, E> {
        return this._instances;
    }

    register(name: string, construct: IConstructor<E>, lifetime: LifetimeEnum = LifetimeEnum.SINGLETON): this {
        this._classes.set(name, {name, construct, lifetime} as T);
        return this;
    }

    resolveArguments(definition: T): any[] {
        try {
            const deps = Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.GRAFT, definition.construct) || [];
            return deps.map((dep: IConstructor, index: number) => {
                const depName = [...this._classes.entries()]
                    .find(([, value]) => value.construct === dep)?.[0];

                if (!depName) throw new Throwable(`Dependency (${index}) not registered in ${this.artifact} on ${definition.name}`);
                return this.get(depName);
            });

        } catch (e) {
            Logger.error('Resolve', e);
            return [];
        }
    }

    get<T>(name: string): T | undefined {
        if (this._instances.has(name)) {
            const current = this._classes.get(name);
            return current ?
                (
                    (current.lifetime === LifetimeEnum.SINGLETON)
                        ? current.instance
                        : new current.construct(...this.resolveArguments(current)) as any
                ) : undefined;
        }

        const cls = this._classes.get(name);
        if (!cls) throw new Throwable(`Dependency artifact ${name} not registered`);

        if (cls.lifetime === LifetimeEnum.SINGLETON) {
            if (!cls.instance)
                cls.instance = new cls.construct(...this.resolveArguments(cls));
            return cls.instance;
        }

        if (cls.lifetime === LifetimeEnum.TRANSIENT)
            return new cls.construct(...this.resolveArguments(cls)) as any;

        return undefined;
    }


    async imports(): Promise<string[]> {
        const imported: string[] = []
        const files = [
            ...(ArtifactFactory.get(this.artifact) || ArtifactFactory.load(this.artifact).get(this.artifact))?.values() || []
        ]

        for (let file of files) {
            try {
                await import(file.absolute);
                imported.push(file.absolute);
            } catch (e) {
                Logger.error('Dependency import', e)
            }
        }

        return imported;
    }
}