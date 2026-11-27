import fs from "node:fs";
import path from "node:path";
import {RaitonConfig} from "../config/config.ts";
import type {ArtifactBridgeEntry} from "../../types/bridge.ts";
import type {BridgeDiagnostic} from "../../types/bridge.ts";
import {bridgeDiagnostic} from "./diagnostics.ts";
import {readJsonFile, resolvePackageJson} from "./resolver.ts";

import hostPackage from "../../../package.json" with {type: "json"};

export interface PackageBridgeEntry {
    entry: ArtifactBridgeEntry;
    package: string;
    packageRoot: string;
    location: string;
    origin: "package";
}

export interface PackageDiscoveryResult {
    packages: string[];
    entries: PackageBridgeEntry[];
    diagnostics: BridgeDiagnostic[];
}

function major(version: string | undefined): number | null {
    if (!version) return null;
    const match = String(version).replace(/^[^\d]*/, "").match(/^(\d+)/);
    return match ? Number(match[1]) : null;
}

function directDependencies(packageJson: any): string[] {
    return [...new Set([
        ...Object.keys(packageJson?.dependencies ?? {}),
        ...Object.keys(packageJson?.devDependencies ?? {}),
    ])].sort();
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => typeof item === "string" && item.trim().length > 0);
}

/**
 * Normalize `package.json#raiton.artifacts`.
 *
 * Accepted forms:
 * - `"./dist/artifacts.bridge.js"`
 * - `["./dist/users.controller.js", "./dist/users.service.js"]`
 * - `{ "artifacts": [...] }` (a bridge definition serialized in JSON)
 */
function normalizeField(field: unknown): ArtifactBridgeEntry[] | null {
    if (typeof field === "string" && field.trim()) return [field];
    if (isStringArray(field)) return field;
    if (Array.isArray(field)) {
        const entries = field.filter(item =>
            typeof item === "string"
            || (item && typeof item === "object" && Array.isArray((item as any).artifacts)));
        return entries.length === field.length ? entries as ArtifactBridgeEntry[] : null;
    }
    if (field && typeof field === "object" && Array.isArray((field as any).artifacts)) {
        return (field as any).artifacts as ArtifactBridgeEntry[];
    }
    return null;
}

export interface DiscoverPackagesOptions {
    /** Only inspect these packages (already filtered). */
    allowlist?: string[];
    /** Set to false to disable package discovery entirely. */
    enabled?: boolean;
    /** Emit info diagnostics for discovered packages. */
    verbose?: boolean;
}

/**
 * Inspect direct dependencies only. There is deliberately no recursive
 * `node_modules` walk: each package is resolved by name from the project root.
 */
export function discoverPackageArtifacts(
    workdir: string,
    options: DiscoverPackagesOptions = {},
): PackageDiscoveryResult {
    const config = RaitonConfig.get("artifacts");
    const enabled = options.enabled ?? config?.packages ?? true;
    if (!enabled) return {packages: [], entries: [], diagnostics: []};

    const packageFile = path.join(workdir, "package.json");
    if (!fs.existsSync(packageFile)) return {packages: [], entries: [], diagnostics: []};

    let projectPackage: any;
    try {
        projectPackage = readJsonFile(packageFile);
    } catch (error: any) {
        return {
            packages: [],
            entries: [],
            diagnostics: [bridgeDiagnostic("BRIDGE_PACKAGE_FIELD_INVALID", {
                message: `Cannot read project package.json: ${error?.message ?? error}`,
                location: packageFile,
            })],
        };
    }

    const allowlist = options.allowlist ?? config?.packageAllowlist;
    const allowSet = allowlist?.length ? new Set(allowlist) : null;
    const dependencies = directDependencies(projectPackage)
        .filter(name => !allowSet || allowSet.has(name));

    const entries: PackageBridgeEntry[] = [];
    const packages: string[] = [];
    const diagnostics: BridgeDiagnostic[] = [];
    const hostMajor = major(hostPackage.version);

    for (const name of dependencies) {
        const packageJsonFile = resolvePackageJson(name, workdir);
        if (!packageJsonFile) continue;

        let packageJson: any;
        try {
            packageJson = readJsonFile(packageJsonFile);
        } catch (error: any) {
            diagnostics.push(bridgeDiagnostic("BRIDGE_PACKAGE_FIELD_INVALID", {
                package: name,
                message: `Cannot read ${name}/package.json: ${error?.message ?? error}`,
                location: packageJsonFile,
            }));
            continue;
        }

        const field = packageJson?.raiton?.artifacts;
        if (field === undefined) continue;

        const normalized = normalizeField(field);
        if (!normalized) {
            diagnostics.push(bridgeDiagnostic("BRIDGE_PACKAGE_FIELD_INVALID", {
                package: name,
                message: `${name} declares an invalid package.json#raiton.artifacts field`,
                location: packageJsonFile,
            }));
            continue;
        }

        const packageRoot = path.dirname(packageJsonFile);
        packages.push(name);

        // ABI / packaging contract checks.
        if (packageJson.dependencies?.raiton) {
            diagnostics.push(bridgeDiagnostic("BRIDGE_ABI_MISMATCH", {
                package: name,
                message: `${name} embeds Raiton in dependencies instead of peerDependencies`,
                action: "Move `raiton` to peerDependencies and rebuild the package.",
                location: packageJsonFile,
            }));
        }
        const peer = packageJson.peerDependencies?.raiton;
        const peerMajor = major(peer);
        if (peer && hostMajor !== null && peerMajor !== null && peerMajor !== hostMajor) {
            diagnostics.push(bridgeDiagnostic("BRIDGE_ABI_MISMATCH", {
                package: name,
                message: `${name} targets Raiton ${peer}, host is ${hostPackage.version}`,
                action: "Align the package's raiton peerDependency with the host major version and rebuild it.",
                location: packageJsonFile,
            }));
        }
        const nested = path.join(packageRoot, "node_modules", "raiton", "package.json");
        if (fs.existsSync(nested)) {
            diagnostics.push(bridgeDiagnostic("BRIDGE_ABI_MISMATCH", {
                package: name,
                message: `${name} contains its own copy of Raiton`,
                action: "Remove the nested raiton copy and declare `raiton` as a peerDependency.",
                location: nested,
            }));
        }

        for (const entry of normalized) {
            entries.push({
                entry,
                package: name,
                packageRoot,
                location: packageJsonFile,
                origin: "package",
            });
        }

        if (options.verbose) {
            diagnostics.push(bridgeDiagnostic("BRIDGE_PACKAGE_FIELD_INVALID", {
                severity: "info",
                package: name,
                message: `${name} declares ${normalized.length} bridge artifact(s)`,
                action: "No action required.",
                location: packageJsonFile,
            }));
        }
    }

    return {packages, entries, diagnostics};
}
