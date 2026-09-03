import {Injection} from "../core/injection";
import {Logger} from "@protorians/logger";
import type {ConstructorType} from "../types";
import {Raiton} from "../core/raiton";
import {isArtifact} from "./utilities";
import {compileMcp} from "../core/mcp/builder";

export type HmrChannel =
    | 'hmr:di'
    | 'hmr:controller'
    | 'hmr:socket'
    | 'hmr:middleware'
    | 'hmr:hook'
    | 'hmr:mcp'
    | 'hmr:health-check'

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

            if (typeof name === 'string') {
                if (typeof mod === 'function') {
                    const instance = new (mod as ConstructorType)()
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

            if (typeof name === 'string') {
                if (typeof mod === 'function') {
                    const instance = new (mod as ConstructorType)()
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
}
