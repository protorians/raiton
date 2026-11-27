import fs from "node:fs";
import {BuilderHMRDeclarationInterface} from "../../types/index.ts";
import {LBadge, Logger} from "@protorians/logger";
import {RaitonThread} from "../thread.ts";
import {Injection} from "../injection/index.ts";
import {Artifacts, type ArtifactClassification} from "../../framework/artifacts.ts";
import {METADATA_KEYS} from "../../framework/constants/decorators.constant.ts";
import path from "node:path";
import {ControllerRouteTracker} from "./tracker.ts";
import {ArtifactRegistry} from "../bridge/registry.ts";
import {isMountableClassification, kindForClassification, mountArtifact} from "../artifact-mount.ts";
import {compileController} from "./compiler.ts";

export class ControllerBuilder {

    static async scan(workdir: string) {
        const files = fs.readdirSync(workdir, {recursive: true})
            .map(file => file.toString());
        const output: any[] = []
        const timestamp = Date.now()

        // One classification per file, reused by both passes. The source
        // directory is read exactly once. The bridge file and the local files
        // it declares are excluded so they are mounted only once.
        const entries = files
            .map(file => {
                const filename = path.join(workdir, file);
                return {filename, classification: Artifacts.classify(filename)}
            })
            .filter(({filename}) =>
                !Artifacts.isBridge(filename) && !ArtifactRegistry.isExcludedFile(filename)
            )

        for (const {filename, classification} of entries) {
            if (classification?.channel !== 'hmr:di') continue;
            await this.loadDiArtifact(filename, 1, timestamp);
        }

        for (const {filename, classification} of entries) {
            if (!classification) continue;
            output.push(await this.build<any>({filename, version: 1, timestamp}, classification))
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

    static async build<T>(
        {filename, version, timestamp}: BuilderHMRDeclarationInterface,
        classification?: ArtifactClassification | null,
    ): Promise<T | undefined> {
        const resolvedClassification = classification === undefined
            ? Artifacts.classify(filename)
            : classification

        if (!resolvedClassification)
            return undefined;

        if (!isMountableClassification(resolvedClassification))
            return undefined;

        const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
        const artifact = resolveArtifact(imported, {
            isController: resolvedClassification.channel === 'hmr:controller',
            isSocket: resolvedClassification.channel === 'hmr:socket',
            isMcp: resolvedClassification.channel === 'hmr:mcp',
            isScheduler: resolvedClassification.channel === 'hmr:scheduler',
        });

        if (!artifact) return undefined;
        return await this.buildArtifact<T>(artifact, resolvedClassification, "scan", {file: filename});
    }

    /**
     * Compile an artifact that is already imported. The bridge uses this method
     * so it does not re-import classes by path and does not duplicate any
     * compiler logic.
     */
    static async buildArtifact<T>(
        artifact: any,
        classification: ArtifactClassification,
        origin: "scan" | "bridge" = "scan",
        options: {file?: string; package?: string} = {},
    ): Promise<T | undefined> {
        if (!artifact || !isMountableClassification(classification)) return undefined;
        if (!RaitonThread.current?.application) return undefined;

        const existing = ArtifactRegistry.getByConstruct(artifact);
        if (existing) {
            if (origin === "bridge" && existing.origin !== "bridge" && existing.origin !== "package") {
                Logger.debug(
                    `[bridge] ${artifact.name ?? "artifact"} already mounted by the scan; skipping duplicate`
                );
            }
            return existing as unknown as T;
        }

        const record = await mountArtifact(artifact, kindForClassification(classification), RaitonThread.current.application, {
            origin,
            file: options.file,
            package: options.package,
        });
        return record as unknown as T;
    }

    static async recompile(modulo: any, filename: string): Promise<void> {
        const app = RaitonThread.current?.application
        if (!app) return

        const rootScope = (app as any).root

        // A controller edit may rename the class. Remove routes tracked under
        // the previous name(s) for this file before compiling the new class.
        if (rootScope?.router && filename) {
            for (const previousName of Injection.getArtifactNames(filename)) {
                ControllerRouteTracker.removeRoutes(previousName, rootScope.router)
                Injection.invalidateCascade(previousName)
            }
        }

        for (const mod of Object.values(modulo)) {
            const name = (mod && typeof mod === 'object' && 'name' in mod) ? mod.name : (
                typeof mod === 'function' ? mod.name ?? mod.constructor.name : undefined
            );

            if (typeof name === 'string' && typeof mod === 'function') {
                Injection.invalidateCascade(name)
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
