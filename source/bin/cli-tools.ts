import {spawn} from 'node:child_process';
import {isBunUsed, isDenoUsed} from "./constants";


export class CliTools {
    static get cwd() {
        return `${isDenoUsed ? (globalThis as any).Deno.cwd() : process.cwd()}`;
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
        if (isDenoUsed) return (globalThis as any).Deno.args;
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
            return spawn('node', ['--loader', 'ts-node/register', cmd, ...cmdArgs], options);
        }

        return spawn(cmd, cmdArgs, options);
    }
}