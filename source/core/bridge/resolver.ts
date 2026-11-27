import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {pathToFileURL} from "node:url";
import {BridgeError} from "./diagnostics.ts";

export const LOCAL_PATH_PATTERN = /^(\.\.?\/|\/|file:)/;
export const REMOTE_URL_PATTERN = /^(https?:|npm:|jsr:|data:|node:)/i;

const SOURCE_EXTENSIONS = [".ts", ".mts", ".cts", ".js", ".mjs", ".cjs", ".tsx", ".jsx"];

export function isLocalPathSpecifier(specifier: string): boolean {
    return LOCAL_PATH_PATTERN.test(specifier);
}

export function isRemoteSpecifier(specifier: string): boolean {
    return REMOTE_URL_PATTERN.test(specifier);
}

/**
 * Best-effort package name for an import specifier. Used for diagnostics and
 * manifest package attribution only.
 */
export function packageNameFromSpecifier(specifier: string): string | undefined {
    if (!specifier || isLocalPathSpecifier(specifier) || isRemoteSpecifier(specifier)) return undefined;
    const segments = specifier.split("/");
    if (specifier.startsWith("@")) return segments.slice(0, 2).join("/");
    return segments[0];
}

function candidatesForLocal(base: string): string[] {
    const extension = path.extname(base).toLowerCase();
    if (SOURCE_EXTENSIONS.includes(extension)) {
        const stem = base.slice(0, -extension.length);
        return [...new Set([base, ...SOURCE_EXTENSIONS.map(candidate => `${stem}${candidate}`)])];
    }
    return [...SOURCE_EXTENSIONS.map(candidate => `${base}${candidate}`)];
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
 * Resolve a local path relative to the bridge/package directory first, then
 * the project root. This also keeps compiled Node bridges usable when local
 * entries are expressed relative to the source root.
 */
export function resolveLocalModule(
    specifier: string,
    directories: Array<string | undefined>,
): string | null {
    let raw = specifier;
    if (specifier.startsWith("file:")) {
        try {
            raw = new URL(specifier).pathname;
        } catch {
            return null;
        }
    }
    const bases = path.isAbsolute(raw)
        ? [raw]
        : directories.filter(Boolean).map(directory => path.resolve(directory!, raw));
    for (const base of bases) {
        const found = firstExisting(candidatesForLocal(base));
        if (found) return found;
    }
    return null;
}

export interface ResolvedBridgeModule {
    /** Absolute file path, or a builtin/runtime specifier. */
    file: string;
    /** Package name when the specifier is a bare package import. */
    package?: string;
    /** True when the module lives in `node_modules`. */
    external: boolean;
}

export function resolveBridgeModule(
    specifier: string,
    options: {directories: Array<string | undefined>; workdir: string},
): ResolvedBridgeModule {
    if (!specifier || typeof specifier !== "string") {
        throw new BridgeError("BRIDGE_ENTRY_INVALID", {
            message: "Bridge module specifier must be a non-empty string",
            entry: String(specifier),
        });
    }
    if (isRemoteSpecifier(specifier) && !specifier.startsWith("node:")) {
        throw new BridgeError("BRIDGE_ENTRY_INVALID", {
            message: `Remote URL imports are not supported by the artifacts bridge: ${specifier}`,
            action: "Import from an installed package or a local file instead.",
            entry: specifier,
        });
    }

    if (isLocalPathSpecifier(specifier)) {
        const found = resolveLocalModule(specifier, options.directories);
        if (!found) {
            throw new BridgeError("BRIDGE_MODULE_NOT_FOUND", {
                message: `Local bridge module was not found: ${specifier}`,
                location: options.directories.find(Boolean) ?? options.workdir,
                entry: specifier,
            });
        }
        return {file: found, external: found.includes(`${path.sep}node_modules${path.sep}`)};
    }

    if (specifier.startsWith("node:")) {
        return {file: specifier, external: true};
    }

    const packageName = packageNameFromSpecifier(specifier);
    const requireFromProject = createRequire(path.join(options.workdir, "package.json"));
    try {
        const resolved = requireFromProject.resolve(specifier);
        return {
            file: resolved,
            package: packageName,
            external: resolved.includes(`${path.sep}node_modules${path.sep}`),
        };
    } catch {
        // A local directory may still be addressable by an alias/relative path.
        const found = resolveLocalModule(specifier, options.directories);
        if (found) return {file: found, package: packageName, external: false};
        throw new BridgeError("BRIDGE_MODULE_NOT_FOUND", {
            message: `Bridge module could not be resolved: ${specifier}`,
            action: packageName
                ? `Install \`${packageName}\` in the project or fix its package name.`
                : "Fix the module path or install the missing dependency.",
            entry: specifier,
            module: packageName,
        });
    }
}

export async function importBridgeModule(
    resolved: ResolvedBridgeModule,
    options: {cacheBust?: boolean} = {},
): Promise<any> {
    const url = resolved.file.startsWith("node:")
        ? resolved.file
        : pathToFileURL(resolved.file).href;
    // Bun (and Deno's file loader) cache modules by path: a `file://` URL with
    // a query string is still served from the first evaluation. A plain
    // absolute path plus a query is a real cache key on those runtimes.
    const href = options.cacheBust && !resolved.file.startsWith("node:")
        ? `${resolved.file}${resolved.file.includes("?") ? "&" : "?"}v=${Date.now()}&t=${Date.now()}`
        : url;
    try {
        return await import(href);
    } catch (error: any) {
        throw new BridgeError("BRIDGE_IMPORT_FAILED", {
            message: `Bridge module failed to load: ${resolved.file} (${error?.message ?? error})`,
            location: resolved.file,
            entry: resolved.file,
            module: resolved.package,
        });
    }
}

export function resolvePackageJson(packageName: string, workdir: string): string | null {
    const requireFromProject = createRequire(path.join(workdir, "package.json"));
    try {
        return requireFromProject.resolve(`${packageName}/package.json`);
    } catch {
        const direct = path.join(workdir, "node_modules", ...packageName.split("/"), "package.json");
        if (fs.existsSync(direct)) return direct;
        return null;
    }
}

export function readJsonFile<T = any>(filename: string): T {
    return JSON.parse(fs.readFileSync(filename, "utf-8")) as T;
}
