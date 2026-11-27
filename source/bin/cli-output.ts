import {Logger} from "@protorians/logger";

/** Version of the stable CLI JSON envelope. */
export const CLI_JSON_SCHEMA_VERSION = "1.0.0";

export enum ExitCode {
    SUCCESS = 0,
    USAGE = 1,
    PREREQUISITE_MISSING = 2,
    FILE_CONFLICT = 3,
    DIAGNOSTIC_FAILED = 4,
}

export interface CliErrorOptions {
    code?: string;
    hint?: string;
    docsUrl?: string;
    location?: string;
    exitCode?: ExitCode;
}

/**
 * Stable CLI error shape shared by every command:
 * `{ code, message, hint, docsUrl, location? }`.
 */
export class CliError extends Error {
    public readonly code: string;
    public readonly hint: string;
    public readonly docsUrl: string;
    public readonly location?: string;
    public readonly exitCode: ExitCode;

    constructor(message: string, options: CliErrorOptions = {}) {
        super(message);
        this.name = "CliError";
        this.code = options.code ?? "COMMAND_FAILED";
        this.hint = options.hint ?? "Run `raiton --help` to inspect available commands.";
        this.docsUrl = options.docsUrl ?? "https://github.com/protorians/raiton/blob/main/docs/user-guide/cli.md";
        this.location = options.location;
        this.exitCode = options.exitCode ?? ExitCode.USAGE;
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            hint: this.hint,
            docsUrl: this.docsUrl,
            ...(this.location ? {location: this.location} : {}),
        };
    }
}

export function fail(error: unknown, json = false): void {
    const cliError = error instanceof CliError
        ? error
        : new CliError(
            error instanceof Error ? error.message : String(error),
            {
                code: "COMMAND_FAILED",
                hint: "Check the command arguments and the project configuration.",
                exitCode: ExitCode.USAGE,
            },
        );

    if (json) {
        process.stdout.write(JSON.stringify({
            error: true,
            schemaVersion: CLI_JSON_SCHEMA_VERSION,
            ...cliError.toJSON(),
        }, null, 2) + "\n");
    } else {
        Logger.error(`${cliError.code}: ${cliError.message}`);
        Logger.info(`Hint: ${cliError.hint}`);
        Logger.info(`Docs: ${cliError.docsUrl}`);
        if (cliError.location) Logger.info(`Location: ${cliError.location}`);
    }

    process.exitCode = cliError.exitCode;
}

export function printJson(value: unknown): void {
    process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

export function print(value: unknown, json = false): void {
    if (json) printJson(value);
    else if (typeof value === "string") process.stdout.write(value + "\n");
    else process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

/**
 * Redirect incidental framework logs to stderr while a machine-readable
 * command runs, so `--json` always emits exactly one valid JSON document on
 * stdout.
 */
export async function silenceStdout<T>(callable: () => Promise<T> | T): Promise<T> {
    const originalWrite = process.stdout.write.bind(process.stdout);
    const originalLog = console.log;

    const redirect = (...args: any[]) => {
        process.stderr.write(args.map(value => typeof value === "string" ? value : JSON.stringify(value)).join(" ") + "\n");
    };

    (process.stdout as any).write = (chunk: any, encoding?: any, callback?: any) => {
        if (typeof encoding === "function") {
            return process.stderr.write(chunk, encoding);
        }
        return process.stderr.write(chunk, encoding, callback);
    };
    console.log = redirect;

    try {
        return await callable();
    } finally {
        (process.stdout as any).write = originalWrite;
        console.log = originalLog;
    }
}

export function isInteractive(): boolean {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function ensureNonInteractive(required: Record<string, any>): void {
    const missing = Object.entries(required)
        .filter(([, value]) => value === undefined || value === null || value === "")
        .map(([key]) => key);
    if (missing.length) {
        throw new CliError(
            `Missing required option(s): ${missing.join(", ")}`,
            {
                code: "MISSING_OPTION",
                hint: `Provide ${missing.map(key => `--${key}`).join(", ")} in non-interactive mode.`,
                exitCode: ExitCode.USAGE,
            },
        );
    }
}
