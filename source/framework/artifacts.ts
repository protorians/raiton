import {Injection} from "../core/injection/index.ts";
import {Logger} from "@protorians/logger";
import type {ConstructorType} from "../types/index.ts";
import {Raiton} from "../core/raiton.ts";
import {isArtifact} from "./utilities/index.ts";
import {compileMcp} from "../core/mcp/builder.ts";
import {compileScheduler} from "../core/scheduler/builder.ts";

/**
 * Un artefact middleware/hook peut être exporté sous deux formes : une classe
 * (instanciée par le conteneur) ou une fonction `(context) => …`. Instancier
 * systématiquement lève « function is not a constructor » dès que la fonction
 * est fléchée ou `async` — et un `function` classique, lui constructible, ne
 * doit pas être instancié non plus. On ne reconnaît donc que la syntaxe classe.
 */
function isClass(value: unknown): value is ConstructorType {
    if (typeof value !== 'function') return false
    if (!/^\s*class[\s{]/.test(Function.prototype.toString.call(value))) return false
    try {
        Reflect.construct(Object, [], value)
        return true
    } catch {
        return false
    }
}

/**
 * Un artefact de middleware *décorateur* n'est pas enregistré dans le pipeline
 * racine : le remplacer l'y ajouterait et le ferait exécuter sur **toutes** les
 * requêtes. On ne remplace donc que les entrées déjà présentes.
 */
function isRegistered(registry: any, name: string): boolean {
    const normalized = name.toLowerCase()
    const stack = registry?.stack
    if (Array.isArray(stack)) {
        return stack.some((entry: any) => {
            const entryName = typeof entry === 'function' ? entry.name : entry?.name
            return typeof entryName === 'string' && entryName.toLowerCase() === normalized
        })
    }
    const hooks = registry?.hooks
    if (hooks instanceof Map) {
        return [...hooks.keys()].some(
            (key) => typeof key === 'string' && key.toLowerCase() === normalized
        )
    }
    return false
}

export type HmrChannel =
    | 'hmr:di'
    | 'hmr:controller'
    | 'hmr:socket'
    | 'hmr:middleware'
    | 'hmr:hook'
    | 'hmr:mcp'
    | 'hmr:health-check'
    | 'hmr:scheduler'

export interface ArtifactClassification {
    channel: HmrChannel
    artifactType: string
}

export const HMR_CHANNELS: Record<HmrChannel, readonly string[]> = {
    'hmr:di': [
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
        'use-case',
        'dto',
        'vm',
        'entity',
        'model',
        'schema',
        'validator',
        'strategy',
        'strategy-provider',
        'strategy-type',
    ],
    'hmr:controller': ['controller'],
    'hmr:socket': ['socket'],
    'hmr:middleware': ['middleware'],
    'hmr:hook': ['hook', 'event', 'listener'],
    'hmr:mcp': ['mcp'],
    'hmr:health-check': ['health-check'],
    'hmr:scheduler': ['scheduler', 'task', 'cron', 'job'],
}

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
        'vm',
        'entity',
        'model',
        'schema',
        'socket',
        'mcp',
        'health-check',
        'scheduler',
        'task',
        'cron',
        'job',
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

    static classify(filename: string): ArtifactClassification | null {
        for (const [channel, types] of Object.entries(HMR_CHANNELS)) {
            for (const type of types) {
                if (isArtifact(filename, type)) {
                    return {channel: channel as HmrChannel, artifactType: type}
                }
            }
        }
        return null
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

    static reloadDi(modulo: any, filename?: string) {

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
                Injection.invalidateCascade(name)
            }
        }
    }

    static reloadMiddleware(modulo: any, filename?: string) {

        if (Raiton.thread?.builder.options.serve === false)
            return Logger.warn(
                'Artifact reload is only available in development mode'
            )

        const app = Raiton.thread?.application
        if (!app) return

        const rootScope = (app as any).root
        if (!rootScope?.middleware) return

        for (const mod of Object.values(modulo)) {
            const name = (mod && typeof mod === 'object' && 'name' in mod) ? mod.name : (
                typeof mod === 'function' ? mod.name ?? mod.constructor.name : undefined
            );

            if (typeof name === 'string' && isRegistered(rootScope.middleware, name)) {
                if (typeof mod === 'function') {
                    const instance = isClass(mod) ? new (mod as ConstructorType)() : mod
                    rootScope.middleware.replace(name, instance)
                } else if (typeof mod === 'object' && mod !== null) {
                    rootScope.middleware.replace(name, mod)
                }
            }
        }
    }

    static reloadHook(modulo: any, filename?: string) {

        if (Raiton.thread?.builder.options.serve === false)
            return Logger.warn(
                'Artifact reload is only available in development mode'
            )

        const app = Raiton.thread?.application
        if (!app) return

        const rootScope = (app as any).root
        if (!rootScope?.hooks) return

        for (const mod of Object.values(modulo)) {
            const name = (mod && typeof mod === 'object' && 'name' in mod) ? mod.name : (
                typeof mod === 'function' ? mod.name ?? mod.constructor.name : undefined
            );

            if (typeof name === 'string' && isRegistered(rootScope.hooks, name)) {
                if (typeof mod === 'function') {
                    const instance = isClass(mod) ? new (mod as ConstructorType)() : mod
                    rootScope.hooks.replace(name, instance)
                } else if (typeof mod === 'object' && mod !== null) {
                    rootScope.hooks.replace(name, mod)
                }
            }
        }
    }

    static reloadMcp(modulo: any, filename?: string) {

        if (Raiton.thread?.builder.options.serve === false)
            return Logger.warn(
                'Artifact reload is only available in development mode'
            )

        const app = Raiton.thread?.application
        if (!app) return

        const rootScope = (app as any).root
        if (!rootScope?.router) return

        for (const mod of Object.values(modulo)) {
            const name = (mod && typeof mod === 'object' && 'name' in mod) ? mod.name : (
                typeof mod === 'function' ? mod.name ?? mod.constructor.name : undefined
            );

            if (typeof name === 'string' && typeof mod === 'function') {
                Injection.invalidateCascade(name)
                if (filename) Injection.registerArtifactPath(name, filename)
                compileMcp(mod)
            }
        }
    }

    static reloadScheduler(modulo: any, filename?: string) {

        if (Raiton.thread?.builder.options.serve === false)
            return Logger.warn(
                'Artifact reload is only available in development mode'
            )

        for (const mod of Object.values(modulo)) {
            const name = (mod && typeof mod === 'object' && 'name' in mod) ? mod.name : (
                typeof mod === 'function' ? mod.name ?? mod.constructor.name : undefined
            );

            if (typeof name === 'string' && typeof mod === 'function') {
                Injection.invalidateCascade(name)
                if (filename) Injection.registerArtifactPath(name, filename)
                compileScheduler(mod)
            }
        }
    }
}
