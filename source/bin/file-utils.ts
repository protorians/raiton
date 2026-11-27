import fs from "node:fs";
import path from "node:path";
import {CliError, ExitCode} from "./cli-output.ts";

export interface GeneratedFile {
    path: string;
    content: string;
}

export interface WriteOptions {
    force?: boolean;
    dryRun?: boolean;
}

export interface WriteResult {
    files: string[];
    conflicts: string[];
    written: string[];
    dryRun: boolean;
}

/**
 * Write generated files without ever overwriting an existing file unless
 * `force` is explicit. `dryRun` returns the same plan without touching disk.
 */
export function writeFiles(baseDir: string, files: GeneratedFile[], options: WriteOptions = {}): WriteResult {
    const resolved = files.map(file => ({
        ...file,
        absolute: path.resolve(baseDir, file.path),
    }));

    const conflicts = resolved
        .filter(file => fs.existsSync(file.absolute))
        .map(file => path.relative(baseDir, file.absolute));

    if (conflicts.length && !options.force) {
        throw new CliError(
            `Refusing to overwrite existing file(s): ${conflicts.join(", ")}`,
            {
                code: "FILE_CONFLICT",
                hint: "Choose another target, or pass --force to overwrite explicitly.",
                docsUrl: "https://github.com/protorians/raiton/blob/main/docs/user-guide/cli.md",
                exitCode: ExitCode.FILE_CONFLICT,
            },
        );
    }

    if (options.dryRun) {
        return {
            files: resolved.map(file => file.path),
            conflicts,
            written: [],
            dryRun: true,
        };
    }

    const written: string[] = [];
    for (const file of resolved) {
        fs.mkdirSync(path.dirname(file.absolute), {recursive: true});
        fs.writeFileSync(file.absolute, file.content, "utf-8");
        written.push(file.path);
    }

    return {
        files: resolved.map(file => file.path),
        conflicts,
        written,
        dryRun: false,
    };
}

export function isDirectoryEmpty(directory: string): boolean {
    if (!fs.existsSync(directory)) return true;
    return fs.readdirSync(directory).filter(name => name !== ".DS_Store").length === 0;
}

export function readJsonFile<T = any>(filename: string): T {
    if (!fs.existsSync(filename)) {
        throw new CliError(`File not found: ${filename}`, {
            code: "FILE_NOT_FOUND",
            hint: "Check the path and try again.",
            location: filename,
            exitCode: ExitCode.PREREQUISITE_MISSING,
        });
    }
    try {
        return JSON.parse(fs.readFileSync(filename, "utf-8"));
    } catch (error: any) {
        throw new CliError(`Invalid JSON in ${filename}: ${error.message}`, {
            code: "INVALID_JSON",
            hint: "Fix the file or regenerate it with `raiton inspect --out`.",
            location: filename,
        });
    }
}
