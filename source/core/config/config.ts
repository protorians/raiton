import path from "node:path";
import fs from "node:fs";
import {Configurable} from "@/types";
import {Logger} from "@protorians/logger";
import {Raiton} from "@/core/raiton";

export class RaitonConfig {
    static readonly current: Map<keyof Configurable, Configurable[keyof Configurable]> = new Map();

    protected static _extensions: string[] = ['.js', '.mjs'];

    static get<K extends keyof Configurable>(key: K): Configurable[K] | undefined {
        return this.current.get(key) as Configurable[K];
    }

    static defaultConfig: Configurable = {
        rootDir: '.',
        version: '0.0.1'
    }

    static async sync(workdir: string) {
        try {
            if (!this.current.size) {
                const configJsonPath = path.join(workdir, `${Raiton.identifier}.config.json`);

                if (fs.existsSync(configJsonPath)) {
                    const configContent = fs.readFileSync(configJsonPath, 'utf-8');
                    for (const [key, value] of Object.entries({...this.defaultConfig, ...(JSON.parse(configContent) || {})}))
                        this.current.set(key as keyof Configurable, value as Configurable[keyof Configurable]);
                } else {
                    for (const ext of this._extensions) {
                        const configPath = path.join(workdir, `${Raiton.identifier}.config${ext}`);
                        if (fs.existsSync(configPath)) {
                            const configModule = await import(configPath);
                            const config = await configModule?.default || configModule;
                            for (const [key, value] of Object.entries(config)) {
                                this.current.set(key as keyof Configurable, value as Configurable[keyof Configurable]);
                            }
                        }
                    }
                }
            }

            return this.current;
        } catch (e: any) {
            Logger.error(`Failed to load ${Raiton.identifier} config:`, e.message ?? e);
            return this.current;
        }

    }
}