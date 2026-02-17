import {Command} from "commander";
import {RaitonCommand} from "./command";
import fs from 'node:fs';
import path from "node:path";
import {Logger} from "@protorians/logger";

export class RaitonCommands {

    public readonly stack: Set<RaitonCommand> = new Set();

    constructor(
        public readonly cli: Command,
        public readonly appdir: string,
        public readonly workdir: string
    ) {
    }

    public async harvest(): Promise<void> {
        const dir = path.join(this.appdir, 'commands');
        
        if (!fs.existsSync(dir)) {
            return;
        }

        const files = fs.readdirSync(dir);

        for (const file of files) {
            if (file.startsWith('~')) continue;
            if (file.endsWith('.d.ts')) continue;
            if (!file.includes('.command.')) continue;

            const filepath = path.join(dir, file);
            const mod = await import(filepath);

            const capability = new mod.default(this.cli, this.workdir, this.appdir)

            if (!(capability instanceof RaitonCommand)) continue;

            capability.register();
            this.stack.add(capability);
        }

    }
}