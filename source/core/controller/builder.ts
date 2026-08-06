import fs from "node:fs";
import {BuilderHMRDeclarationInterface} from "../../types";
import {LBadge, Logger} from "@protorians/logger";
import {compileController} from "./compiler";
import {compileSocket} from "../socket/builder";
import {RaitonThread} from "../thread";
import {Injection} from "../injection";
import {isControllerArtifact, isSocketArtifact} from "../../framework";
import path from "node:path";

export class ControllerBuilder {

    static async scan(workdir: string) {
        const files = fs.readdirSync(workdir, {recursive: true})
            .map(file => file.toString());
        const output: any[] = []

        for (const file of files) {
            output.push(await this.build<any>({filename: path.join(workdir, file), version: 1, timestamp: Date.now()}))
        }

        return output.filter(f => typeof f !== 'undefined');
    }

    static async build<T>({filename, version, timestamp}: BuilderHMRDeclarationInterface): Promise<T | undefined> {
        const isController = isControllerArtifact(filename);
        const isSocket = isSocketArtifact(filename);

        if (!isController && !isSocket)
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

        const compilated = compileController(artifact, RaitonThread.current.application);
        return compilated;
    }

}