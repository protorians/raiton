import {METADATA_KEYS} from "../../framework/constants/decorators.constant.ts";
import type {ArtifactKind, ArtifactBridgeDefinition} from "../../types/bridge.ts";
import type {ConstructorType} from "../../types/contruct.ts";

export type ClassifiedConstruct = {
    construct: ConstructorType;
    name: string;
    kind: ArtifactKind;
};

export function isClass(value: unknown): value is ConstructorType {
    if (typeof value !== "function") return false;
    if (!/^\s*class[\s{]/.test(Function.prototype.toString.call(value))) return false;
    try {
        Reflect.construct(Object, [], value);
        return true;
    } catch {
        return false;
    }
}

function metadataOf(key: symbol, construct: any): any {
    const prototype = construct?.prototype;
    return (prototype ? Reflect.getMetadata(key, prototype) : undefined)
        ?? Reflect.getMetadata(key, construct);
}

function hasControllerMetadata(construct: any): boolean {
    const metadata = metadataOf(METADATA_KEYS.CONTROLLERS, construct);
    return Boolean(metadata)
        && (Array.isArray(metadata.routes) || Object.prototype.hasOwnProperty.call(metadata, "prefix"));
}

/**
 * Classify a class from decorator metadata only. Suffix classification remains
 * authoritative for scanned files; this function is used by the bridge and by
 * multi-artifact module resolution.
 */
export function classifyConstruct(construct: unknown): ClassifiedConstruct | null {
    if (typeof construct !== "function") return null;
    const name = (construct as any).name || (construct as any).constructor?.name;
    if (!name) return null;

    if (hasControllerMetadata(construct)) {
        return {construct: construct as ConstructorType, name, kind: "controller"};
    }
    if (metadataOf(METADATA_KEYS.SOCKETS, construct)) {
        return {construct: construct as ConstructorType, name, kind: "socket"};
    }
    if (metadataOf(METADATA_KEYS.MCP, construct)) {
        return {construct: construct as ConstructorType, name, kind: "mcp"};
    }
    if (metadataOf(METADATA_KEYS.SCHEDULER, construct)) {
        return {construct: construct as ConstructorType, name, kind: "scheduler"};
    }
    if (metadataOf(METADATA_KEYS.CONTAINER, construct)) {
        return {construct: construct as ConstructorType, name, kind: "di"};
    }
    return null;
}

export function isBridgeDefinition(value: unknown): value is ArtifactBridgeDefinition {
    return Boolean(value)
        && typeof value === "object"
        && Array.isArray((value as any).artifacts);
}

export function moduleExports(imported: any): any[] {
    if (!imported || typeof imported !== "object") return [imported];
    const values = Object.values(imported);
    if ("default" in imported && !values.includes(imported.default)) values.push(imported.default);
    return values;
}

export interface ResolveArtifactsOptions {
    kinds?: ArtifactKind[];
}

export interface ResolvedModuleArtifact {
    name: string;
    kind: ArtifactKind;
    construct: ConstructorType;
}

/**
 * Plural counterpart of `resolveArtifact()`: inspect every named export and
 * the default export, keep all decorated classes and deduplicate by identity.
 */
export function resolveArtifacts(
    imported: any,
    options: ResolveArtifactsOptions = {},
): ResolvedModuleArtifact[] {
    const kinds = options.kinds ? new Set(options.kinds) : null;
    const output: ResolvedModuleArtifact[] = [];
    const seen = new Set<unknown>();

    for (const candidate of moduleExports(imported)) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        const classified = classifyConstruct(candidate);
        if (!classified) continue;
        if (kinds && !kinds.has(classified.kind)) continue;
        output.push(classified);
    }

    return output;
}

export function exportNames(imported: any): string[] {
    if (!imported || typeof imported !== "object") return [];
    return Object.keys(imported);
}
