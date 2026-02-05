import {spawn} from 'node:child_process';

const isBunUsed = typeof Bun !== "undefined";

export class CliHelpers {
    static get cwd() {
        return `${process.cwd()}`;
    }

    static set cwd(value: string) {
        process.chdir(value)
    }

    static get argv() {
        return isBunUsed ? Bun.argv : process.argv;
    }

    static get process() {
        return isBunUsed ? Bun : process;
    }

    static spawn(command: string | string[], args: string[] = [], options?: Record<string, any>) {
        if (isBunUsed) {
            const cmdArray = [
                ...(typeof command == 'string' ? [command] : (Array.isArray(command) ? command : [])),
                ...args
            ];
            // If the command is a .ts file, prepend bun
            if (typeof command === 'string' && command.endsWith('.ts')) {
                cmdArray.unshift('bun');
            }
            return Bun.spawn(cmdArray, options);
        }

        const cmd = typeof command == 'string' ? command : command[0];
        // If the command is a .ts file, prepend bun (or npx tsx/ts-node if we wanted to be Node generic, but here we favor Bun)
        if (cmd.endsWith('.ts')) {
            return spawn('bun', [cmd, ...args], options);
        }

        return spawn(cmd, args, options);
    }
}