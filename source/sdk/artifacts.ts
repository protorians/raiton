import {Injection} from "../core/injection";
import {Logger} from "@protorians/logger";
import type {ConstructorType} from "../types";
import {Raiton} from "../core/raiton";
import {isArtifact, isControllerArtifact} from "./utilities";

export class Artifacts {

    static readonly types: Set<string> = new Set();

    static readonly defaultTypes = [
        'service',
        'provider',
        'type',
        'repository',
        'database',
        'db',
        'util',
        'utility',
        'source',
        'controller',
        'middleware',
        'hook',
        'event',
        'listener',
        'validator',
        'strategy',
        'strategy-provider',
        'strategy-type',
    ]

    static register(type: string) {
        this.types.add(type)
        return this
    }

    static registerMany(...types: string[]) {
        for (const type of types) this.register(type)
        return this;
    }

    static is(filename: string) {
        return [...this.types]
            .map(type => isArtifact(filename, type))
            .some(Boolean)
    }

    static reload(modulo: any, filename?: string) {

        if (Raiton.thread?.builder.options.development === false)
            return Logger.warn(
                'Artifact reload is only available in development mode'
            )

        for (const mod of Object.values(modulo)) {
            const name = (mod && typeof mod === 'object' && 'name' in mod) ? mod.name : (
                typeof mod === 'function' ? mod.name ?? mod.constructor.name : undefined
            );

            if (typeof name === 'string' && Injection.has(name)) {
                if (filename) Injection.registerArtifactPath(name, filename);
                Injection.updateConstruct(name, mod as ConstructorType)

                const dependents = Injection.getDependents(name);
                for (const dependent of dependents) {
                    const dependentPath = Injection.getArtifactPath(dependent);
                    if (dependentPath && isControllerArtifact(dependentPath)) {
                        Raiton.signals.dispatch('hmr:controller', {
                            filename: dependentPath,
                            timestamp: Date.now(),
                            version: 1
                        })
                    }
                }
            }
        }

    }
}
