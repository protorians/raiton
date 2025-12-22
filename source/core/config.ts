import path from "node:path";
import fs from "node:fs";
import {Configurable} from "@/types";
import {Logger} from "@protorians/logger";
import {Raiton} from "@/core/raiton";

export class RaitonConfig {
    static readonly current: Map<keyof Configurable, Configurable[keyof Configurable]> = new Map();

    static get(key: keyof Configurable): Configurable[keyof Configurable] {
        return this.current.get(key)!;
    }

    static defaultConfig: Configurable = {
        rootDir: '.',
        version: '0.0.1'
    }

    static load(workdir: string) {
        try {
            if (!this.current.size) {
                const file = path.join(workdir, `${Raiton.identifier}.config.json`);

                if(!fs.existsSync(file)) return this.current;

                const configContent = fs.readFileSync(file, 'utf-8');

                for (const [key, value] of Object.entries({...this.defaultConfig, ...(JSON.parse(configContent) || {})}))
                    this.current.set(key as keyof Configurable, value as Configurable[keyof Configurable]);
            }
            return this.current;
        } catch (e: any) {
            Logger.error(`Failed to load ${Raiton.identifier} config:`, e.message ?? e);
            return this.current;
        }

    }
}