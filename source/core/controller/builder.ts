import fs from "node:fs";
import {BuilderHMRDeclaration} from "@/types";
import {LBadge, Logger} from "@protorians/logger";
import {compileController} from "@/core/controller/compiler";
import {RaitonThread} from "@/core/thread";
import {isControllerFile} from "@/sdk";
import path from "node:path";

export class ControllerBuilder {

    static async scan(workdir: string) {
        const files = fs.readdirSync(workdir, {recursive: true})
            .map(file => file.toString());
        const output: any[] = []

        for (const file of files)
            output.push(await this.build<any>({filename: path.join(workdir, file), version: 1, timestamp: Date.now()}))

        return output.filter(f => typeof f !== 'undefined');
    }

    static async build<T>({filename, version, timestamp}: BuilderHMRDeclaration): Promise<T | undefined> {
        if (!isControllerFile(filename))
            return undefined;

        const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
        const controller = imported.default || imported || undefined;

        if (!controller) return undefined;
        if(!RaitonThread.current.application) return undefined;

        const compilated = compileController(controller, RaitonThread.current.application);
        Logger.log(LBadge.info('Controller'), controller.name, 'compilated');

        return compilated;
    }

}