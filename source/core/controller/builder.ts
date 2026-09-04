import fs from "node:fs";
import {BuilderHMRDeclarationInterface} from "../../types";
import {LBadge, Logger} from "@protorians/logger";
import {compileController} from "./compiler";
import {compileSocket} from "../socket/builder";
import {compileMcp} from "../mcp/builder";
import {RaitonThread} from "../thread";
import {Injection} from "../injection";
import {isControllerArtifact, isSocketArtifact, isMcpArtifact} from "../../framework";
import {Artifacts} from "../../framework/artifacts";
import path from "node:path";
import {ControllerRouteTracker} from "./tracker";

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

        if (!isController && !isSocket && !isMcp)
            return undefined;

        const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
        const artifact = imported.default || imported || undefined;

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
