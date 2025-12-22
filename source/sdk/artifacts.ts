import path from "node:path";
import fs from "fs";
import {Logger} from "@protorians/logger";
import {IFileStatInfo} from "@/types";
import {Raiton} from "@/core/raiton";
import {RaitonDirectories} from "@/core";

export class ArtifactFactory {
    protected static readonly stack: Map<string, Set<IFileStatInfo>> = new Map();

    static getSource(key: string) {
        return path.join(
            RaitonDirectories.artifacts(Raiton.thread.builder.workdir),
            `${key}.json`
        );
    }

    static add(key: string, file: IFileStatInfo) {
        if (!this.stack.has(key)) this.stack.set(key, new Set());
        this.stack.get(key)?.add(file);
    }

    static get(key: string): Set<IFileStatInfo> | undefined {
        return this.stack.get(key);
    }

    static has(key: string): boolean {
        return this.stack.has(key);
    }

    static load(key: string) {
        const outputFile = this.getSource(key)
        if (!fs.existsSync(outputFile)) return;
        const content = fs.readFileSync(outputFile, "utf-8");
        const files = JSON.parse(content) as IFileStatInfo[];
        files.forEach(file => this.add(key, file));
        return this;
    }

    static save(key: string) {
        try {
            const set = this.stack.get(key);
            if (!set) return;
            const content = JSON.stringify([...set.values()]);
            const outputFile = this.getSource(key)
            const dir = path.dirname(outputFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true})
            fs.writeFileSync(outputFile, content, "utf-8");
            return true
        } catch (e) {
            Logger.error(`Failed to save artifacts for key ${key}:`, e);
            return false;
        }
    }
}