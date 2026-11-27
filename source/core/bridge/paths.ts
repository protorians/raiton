import fs from "node:fs";
import path from "node:path";
import {RaitonConfig} from "../config/config.ts";
import {RaitonDirectories} from "../directories.ts";
import {isNodeUsed} from "../../bin/constants.ts";

export const BRIDGE_FILENAME = "artifacts.bridge";
export const COMPILED_BRIDGE_FILENAME = "artifacts.bridge.mjs";

const BRIDGE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"] as const;

export interface BridgeSourceResolution {
    /** Bridge source file, or null when absent. */
    file: string | null;
    /** Programmatic project root. */
    workdir: string;
    /** Configured root directory, absolute. */
    rootDir: string;
    /** True when `artifacts.bridge` explicitly configured the path. */
    explicit: boolean;
    /** True when `artifacts.bridge === false`. */
    disabled: boolean;
    /** Path that was expected (configured or default). */
    expected: string | null;
}

function candidatesFor(base: string): string[] {
    const extension = path.extname(base).toLowerCase();
    if (BRIDGE_EXTENSIONS.includes(extension as any)) {
        const stem = base.slice(0, -extension.length);
        return [...new Set([
            base,
            ...BRIDGE_EXTENSIONS.map(candidate => `${stem}${candidate}`),
        ])];
    }
    return BRIDGE_EXTENSIONS.map(candidate => `${base}${candidate}`);
}

function firstExisting(candidates: string[]): string | null {
    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
        } catch {
            // Ignore unreadable candidates.
        }
    }
    return null;
}

/**
 * Resolve the bridge source from configuration. This is intentionally cheap:
 * only a bounded list of extension candidates is probed, never a directory
 * walk.
 */
export function resolveBridgeSource(workdir = process.cwd()): BridgeSourceResolution {
    const rootDir = path.resolve(workdir, RaitonConfig.get("rootDir") || "./");
    const configured = RaitonConfig.get("artifacts")?.bridge;

    if (configured === false) {
        return {file: null, workdir, rootDir, explicit: false, disabled: true, expected: null};
    }

    if (typeof configured === "string" && configured.trim()) {
        const absolute = path.isAbsolute(configured)
            ? configured
            : null;
        const bases = absolute
            ? [absolute]
            : [...new Set([
                path.resolve(workdir, configured),
                path.resolve(rootDir, configured),
            ])];

        const candidates = bases.flatMap(candidatesFor);
        return {
            file: firstExisting(candidates),
            workdir,
            rootDir,
            explicit: true,
            disabled: false,
            expected: bases[0],
        };
    }

    const expected = path.join(rootDir, BRIDGE_FILENAME);
    return {
        file: firstExisting(candidatesFor(expected)),
        workdir,
        rootDir,
        explicit: false,
        disabled: false,
        expected: candidatesFor(expected)[0],
    };
}

export function compiledBridgeFile(workdir = process.cwd()): string {
    return path.join(RaitonDirectories.server(workdir), COMPILED_BRIDGE_FILENAME);
}

export interface RuntimeBridgeResolution extends BridgeSourceResolution {
    /** File actually imported at runtime. */
    runtimeFile: string | null;
    /** True when the runtime expects a compiled bridge. */
    requiresCompiled: boolean;
}

/**
 * Select the bridge file for the current runtime. Bun and Deno import the
 * source directly; Node uses the compiled `.raiton/server/artifacts.bridge.mjs`.
 */
export function resolveRuntimeBridge(workdir = process.cwd()): RuntimeBridgeResolution {
    const source = resolveBridgeSource(workdir);
    if (isNodeUsed) {
        const compiled = compiledBridgeFile(workdir);
        if (fs.existsSync(compiled)) {
            // Production may ship only `.raiton/server`, without the source
            // tree. The compiled bridge is then the bridge file.
            return {
                ...source,
                file: source.file ?? compiled,
                runtimeFile: compiled,
                requiresCompiled: true,
            };
        }
    }
    if (!source.file) {
        return {...source, runtimeFile: null, requiresCompiled: isNodeUsed};
    }
    if (!isNodeUsed) {
        return {...source, runtimeFile: source.file, requiresCompiled: false};
    }
    return {
        ...source,
        runtimeFile: source.file,
        requiresCompiled: true,
    };
}

export function isSameFile(left: string | null | undefined, right: string | null | undefined): boolean {
    if (!left || !right) return false;
    return path.resolve(left) === path.resolve(right);
}

export function isWithin(parent: string, file: string): boolean {
    const relative = path.relative(path.resolve(parent), path.resolve(file));
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function relativeTo(workdir: string, file?: string | null): string | undefined {
    if (!file) return undefined;
    return path.relative(workdir, file).split(path.sep).join("/");
}
