import fs from "node:fs";
import {BuilderHMRDeclarationInterface} from "../../types/index.ts";
import {LBadge, Logger} from "@protorians/logger";
import {compileController} from "./compiler.ts";
import {compileSocket} from "../socket/builder.ts";
import {compileMcp} from "../mcp/builder.ts";
import {compileScheduler} from "../scheduler/builder.ts";
import {RaitonThread} from "../thread.ts";
import {Injection} from "../injection/index.ts";
import {isControllerArtifact, isSocketArtifact, isMcpArtifact, isSchedulerArtifact} from "../../framework/index.ts";
import {Artifacts} from "../../framework/artifacts.ts";
import {METADATA_KEYS} from "../../framework/constants/index.ts";
import path from "node:path";
import {ControllerRouteTracker} from "./tracker.ts";

export class ControllerBuilder {

    static async scan(workdir: string) {
        const files = fs.readdirSync(workdir, {recursive: true})
            .map(file => file.toString());
        const output: any[] = []
        const timestamp = Date.now()

        for (const file of files) {
            const filename = path.join(workdir, file);
            const classification = Artifacts.classify(filename);
            if (classification?.channel !== 'hmr:di') continue;
            await this.loadDiArtifact(filename, 1, timestamp);
        }

        for (const file of files) {
            output.push(await this.build<any>({filename: path.join(workdir, file), version: 1, timestamp: Date.now()}))
        }

        return output.filter(f => typeof f !== 'undefined');
    }

    static async loadDiArtifact(filename: string, version = 1, timestamp = Date.now()): Promise<void> {
        const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)

        for (const mod of Object.values(imported)) {
            const name = (mod && typeof mod === 'object' && 'name' in mod) ? mod.name : (
                typeof mod === 'function' ? mod.name ?? mod.constructor.name : undefined
            );

            if (typeof name === 'string' && Injection.has(name)) {
                Injection.registerArtifactPath(name, filename)
            }
        }
    }

    static async build<T>({filename, version, timestamp}: BuilderHMRDeclarationInterface): Promise<T | undefined> {
        const isController = isControllerArtifact(filename);
        const isSocket = isSocketArtifact(filename);
        const isMcp = isMcpArtifact(filename);
        const isScheduler = isSchedulerArtifact(filename);

        if (!isController && !isSocket && !isMcp && !isScheduler)
            return undefined;

        const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
        const artifact = resolveArtifact(imported, {isController, isSocket, isMcp, isScheduler});

        if (!artifact) return undefined;
        if (!RaitonThread.current?.application) return undefined;

        const name = artifact.name || (typeof artifact === 'function' ? artifact.name : undefined);
        if (name) Injection.registerArtifactPath(name, filename);

        if (isSocket) {
            return compileSocket(artifact) as any;
        }

        if (isMcp) {
            return compileMcp(artifact) as any;
        }

        if (isScheduler) {
            return compileScheduler(artifact) as any;
        }

        const compilated = compileController(artifact, RaitonThread.current.application);
        return compilated;
    }

    static async recompile(modulo: any, filename: string): Promise<void> {
        const app = RaitonThread.current?.application
        if (!app) return

        for (const mod of Object.values(modulo)) {
            const name = (mod && typeof mod === 'object' && 'name' in mod) ? mod.name : (
                typeof mod === 'function' ? mod.name ?? mod.constructor.name : undefined
            );

            if (typeof name === 'string' && typeof mod === 'function') {
                Injection.invalidateCascade(name)
                const rootScope = (app as any).root
                if (rootScope?.router) {
                    ControllerRouteTracker.removeRoutes(name, rootScope.router)
                }
                Injection.updateConstruct(name, mod as any)
                if (filename) Injection.registerArtifactPath(name, filename)
                compileController(mod, app)
            }
        }
    }
}

interface ArtifactKinds {
    isController: boolean;
    isSocket: boolean;
    isMcp: boolean;
    isScheduler: boolean;
}
/**
 * Sélectionne la classe réellement décorée parmi les exports d'un fichier
 * d'artefact.
 *
 * Les fichiers peuvent exporter leur artefact en `default` **ou** en export
 * nommé (les exemples de la documentation Raiton utilisent `export class
 * MathServer`). L'ancien `imported.default || imported` retombait sur l'objet
 * namespace du module pour un export nommé : `compileMcp` enregistrait alors un
 * serveur fantôme (nom et métadonnées vides) sur le même chemin HTTP.
 */
export function resolveArtifact(imported: any, kinds: ArtifactKinds): any {
    if (!imported || typeof imported !== 'object') return imported;

    const keys: symbol[] = [];
    if (kinds.isController) keys.push(METADATA_KEYS.CONTROLLERS);
    if (kinds.isSocket) keys.push(METADATA_KEYS.SOCKETS);
    if (kinds.isMcp) keys.push(METADATA_KEYS.MCP);
    if (kinds.isScheduler) keys.push(METADATA_KEYS.SCHEDULER);

    const decorated = Object.values(imported)
        .find((candidate) => isDecoratedArtifact(candidate, keys));

    return decorated ?? imported.default ?? imported;
}

function isDecoratedArtifact(candidate: any, keys: symbol[]): boolean {
    if (typeof candidate !== 'function') return false;
    const prototype = candidate.prototype;
    return keys.some((key) =>
        (prototype ? Boolean(Reflect.getMetadata(key, prototype)) : false)
        || Boolean(Reflect.getMetadata(key, candidate)),
    );
}
