import {Injection} from "../core/injection";
import {Logger} from "@protorians/logger";
import type {ConstructorType} from "../types";
import {Raiton} from "../core/raiton";
import {isArtifact} from "./utilities";

export class Artifacts {

    static readonly types: Set<string> = new Set();

    static readonly defaultTypes = [
        'service',
        'provider',
        'type',
        'interface',
        'repository',
        'database',
        'db',
        'util',
        'utility',
        'source',
        'controller',
        'socket',
        'middleware',
        'hook',
        'event',
        'listener',
        'validator',
        'strategy',
        'strategy-provider',
        'strategy-type',
        'use-case',
        'dto',
        'entity',
        'model',
        'schema',
        'socket',
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

        if (Raiton.thread?.builder.options.serve === false)
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

            }
        }

    }
}
