import fs from "node:fs";
import path from "node:path";
import {CliError, ExitCode} from "../bin/cli-output.ts";
import {DebugInvocationError} from "../debug/invocation.ts";

export function collect(value: string, previous: string[] = []): string[] {
    return [...previous, value];
}

export function parsePairs(values: string[] | undefined, label: string): Record<string, string> {
    const output: Record<string, string> = {};
    for (const entry of values ?? []) {
        const index = entry.indexOf("=");
        if (index <= 0) {
            throw new CliError(`Invalid --${label} value: ${entry}`, {
                code: "INVALID_OPTION",
                hint: `Use --${label} key=value.`,
                exitCode: ExitCode.USAGE,
            });
        }
        output[entry.slice(0, index)] = entry.slice(index + 1);
    }
    return output;
}

export function parseData(value: string | undefined, workdir: string): any {
    if (value === undefined) return undefined;
    let content = value;
    if (value.startsWith("@")) {
        const filename = path.resolve(workdir, value.slice(1));
        if (!fs.existsSync(filename)) {
            throw new CliError(`Data file not found: ${value.slice(1)}`, {
                code: "FILE_NOT_FOUND",
                hint: "Check the --data @file path.",
                location: filename,
                exitCode: ExitCode.PREREQUISITE_MISSING,
            });
        }
        content = fs.readFileSync(filename, "utf-8");
    }
    try {
        return JSON.parse(content);
    } catch (error: any) {
        throw new CliError(`Invalid JSON payload: ${error.message}`, {
            code: "INVALID_JSON",
            hint: "Pass a JSON literal or --data @file.json.",
            exitCode: ExitCode.USAGE,
        });
    }
}

export function asCliError(error: unknown, fallbackHint?: string): CliError {
    if (error instanceof CliError) return error;
    if (error instanceof DebugInvocationError) {
        return new CliError(error.message, {
            code: error.code,
            hint: error.hint,
            location: error.location,
            exitCode: error.exitCode as ExitCode,
        });
    }
    const anyError: any = error;
    return new CliError(anyError?.message ?? String(error), {
        code: anyError?.code ?? "COMMAND_FAILED",
        hint: anyError?.hint ?? fallbackHint ?? "Run `raiton --help` to inspect available commands.",
        location: anyError?.location,
        exitCode: anyError?.exitCode ?? ExitCode.USAGE,
    });
}

export function parseMethods(value?: string): string[] {
    if (!value) return [];
    return value.split(",").map(item => item.trim()).filter(Boolean);
}

export function isFailure(result: {contract: {input: string; output: string}; response: {status: number}}, failOn: string[]): boolean {
    if (result.contract.input === "invalid" || result.contract.output === "invalid") return true;
    return failOn.some(filter => matchStatus(result.response.status, filter));
}

export function matchStatus(status: number, filter: string): boolean {
    const value = filter.trim().toLowerCase();
    if (!value) return false;
    if (/^\dxx$/.test(value)) return Math.floor(status / 100) === Number(value[0]);
    if (value.includes("-")) {
        const [min, max] = value.split("-").map(Number);
        return status >= min && status <= max;
    }
    return status === Number(value);
}
