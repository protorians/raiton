/// <reference types="deno" />
import {spawn} from 'node:child_process';
import path from "node:path";
import fs from "node:fs";
import {isBunUsed, isDenoUsed, isNodeUsed} from "./constants.ts";


export class CliTools {
    static get cwd() {
        return `${isDenoUsed ? (globalThis as any).Deno.cwd() : process.cwd()}`;
    }

    /**
     * Resolve the runtime-appropriate CLI entry point.
     * - Node: `build/bin/index.mjs` (compiled bundle)
     * - Bun / Deno: `bin/index.ts` (native TypeScript execution)
     */
    static cliEntry(appdir: string): string {
        if (isNodeUsed) {
            const built = path.join(appdir, 'build', 'bin', 'index.mjs');
            if (fs.existsSync(built)) return built;
            return path.join(appdir, 'bin', 'index.mjs');
        }
        return path.join(appdir, 'bin', 'index.ts');
    }

    static set cwd(value: string) {
        if (isDenoUsed) {
            (globalThis as any).Deno.chdir(value);
        } else {
            process.chdir(value);
        }
    }

    static get argv() {
        if (isBunUsed) return (globalThis as any).Bun.argv;
        if (isDenoUsed) return [globalThis, 'run', ...(globalThis as any).Deno.args];
        return process.argv;
    }

    static get process() {
        if (isBunUsed) return (globalThis as any).Bun;
        if (isDenoUsed) return (globalThis as any).Deno;
        return process;
    }

    static spawn(command: string | string[], args: string[] = [], options?: Record<string, any>) {
        if (isBunUsed) {
            const cmdArray = [
                ...(typeof command == 'string' ? [command] : (Array.isArray(command) ? command : [])),
                ...args
            ];
            if (typeof command === 'string' && command.endsWith('.ts')) {
                cmdArray.unshift('bun');
            }
            return Bun.spawn(cmdArray, options);
        }

        if (isDenoUsed) {
            const cmd = typeof command == 'string' ? command : command[0];
            const cmdArgs = typeof command == 'string' ? args : [...command.slice(1), ...args];

            if (cmd.endsWith('.ts')) {
                return new Deno.Command('deno', {
                    args: ['run', '-A', cmd, ...cmdArgs],
                    ...options
                }).spawn();
            }


            return new Deno.Command(cmd, {
                args: cmdArgs,
                ...options
            }).spawn();
        }

        const cmd = typeof command == 'string' ? command : command[0];
        const cmdArgs = typeof command == 'string' ? args : [...command.slice(1), ...args];

        if (cmd.endsWith('.ts')) {
            const entry = CliTools.cliEntry(path.resolve(cmd, '..', '..'));
            if (fs.existsSync(entry)) {
                return spawn('node', [entry, ...cmdArgs], options);
            }
            return spawn('node', [cmd, ...cmdArgs], options);
        }

        if (cmd.endsWith('.mjs') || cmd.endsWith('.js') || cmd.endsWith('.cjs')) {
            return spawn('node', [cmd, ...cmdArgs], options);
        }

        return spawn(cmd, cmdArgs, options);
    }
}