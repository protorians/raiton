import path from "node:path";
import {Injection} from "../injection/injection.ts";
import type {ArtifactKind, ArtifactOrigin, BridgeManifestArtifact} from "../../types/bridge.ts";
import type {Route} from "../router/route.ts";
import type {HookHandlerCallable, HookNameType} from "../../types/core.ts";

export interface MountedArtifactRecord {
    /** Stable logical key used by the bridge diff. */
    key: string;
    name: string;
    kind: ArtifactKind;
    origin: ArtifactOrigin;
    construct?: unknown;
    package?: string;
    file?: string;
    routes?: Route[];
    middlewareName?: string;
    hookName?: HookNameType;
    handler?: HookHandlerCallable;
    pluginName?: string;
}

export function artifactKey(record: Pick<MountedArtifactRecord, "kind" | "name" | "file" | "package">): string {
    return [record.kind, record.name, record.file ?? "", record.package ?? ""].join("|");
}

/**
 * Central identity registry. It never mounts anything: it records what has
 * already been mounted so the scan and the bridge cannot duplicate routes,
 * middleware, hooks or instances.
 */
export class ArtifactRegistry {
    protected static readonly byConstruct = new WeakMap<object, MountedArtifactRecord>();
    protected static readonly byKey = new Map<string, MountedArtifactRecord>();
    protected static readonly excludedFiles = new Set<string>();

    static clear(): void {
        this.byKey.clear();
        this.excludedFiles.clear();
    }

    /** Remove only bridge-owned records, leaving scan records intact. */
    static clearBridge(): void {
        for (const [key, record] of [...this.byKey]) {
            if (record.origin === "bridge" || record.origin === "package") {
                this.byKey.delete(key);
            }
        }
    }

    static add(record: MountedArtifactRecord): MountedArtifactRecord {
        const existing = this.byKey.get(record.key);
        if (existing) return existing;
        this.byKey.set(record.key, record);
        if (record.construct && (typeof record.construct === "function" || typeof record.construct === "object")) {
            this.byConstruct.set(record.construct as object, record);
        }
        return record;
    }

    static getByKey(key: string): MountedArtifactRecord | undefined {
        return this.byKey.get(key);
    }

    static getByConstruct(construct: unknown): MountedArtifactRecord | undefined {
        if (!construct || (typeof construct !== "function" && typeof construct !== "object")) return undefined;
        const record = this.byConstruct.get(construct as object);
        if (!record) return undefined;
        return this.byKey.get(record.key) === record ? record : undefined;
    }

    static hasConstruct(construct: unknown): boolean {
        return Boolean(this.getByConstruct(construct));
    }

    static remove(key: string): MountedArtifactRecord | undefined {
        const record = this.byKey.get(key);
        if (!record) return undefined;
        this.byKey.delete(key);
        if (record.construct && (typeof record.construct === "function" || typeof record.construct === "object")) {
            const mapped = this.byConstruct.get(record.construct as object);
            if (mapped === record) {
                // WeakMap has no delete-by-value semantics we can observe; the
                // keyed map is authoritative and `getByConstruct` is guarded by
                // the record still being present in `byKey`.
                this.byConstruct.delete(record.construct as object);
            }
        }
        return record;
    }

    static records(): MountedArtifactRecord[] {
        return [...this.byKey.values()];
    }

    static recordsByOrigin(origin: ArtifactOrigin): MountedArtifactRecord[] {
        return this.records().filter(record => record.origin === origin);
    }

    static routeInfo(route: Route): MountedArtifactRecord | undefined {
        for (const record of this.byKey.values()) {
            if (record.routes?.includes(route)) return record;
        }
        const controllerClass = (route.handler as any)?._raitonMeta?.controllerClass;
        if (controllerClass) {
            const record = this.getByConstruct(controllerClass);
            if (record) return record;
        }
        return undefined;
    }

    static excludeFile(filename: string): void {
        this.excludedFiles.add(path.resolve(filename));
    }

    static isExcludedFile(filename: string): boolean {
        return this.excludedFiles.has(path.resolve(filename));
    }

    static setExcludedFiles(files: Iterable<string>): void {
        this.excludedFiles.clear();
        for (const file of files) this.excludeFile(file);
    }

    static excluded(): string[] {
        return [...this.excludedFiles];
    }

    /**
     * Inventory used by `raiton artifact`. Compiled scan artifacts and bridge
     * artifacts come from the registry; DI definitions that were never mounted
     * as routes are added as `di` entries.
     */
    static describeArtifacts(workdir: string): BridgeManifestArtifact[] {
        const output: BridgeManifestArtifact[] = [];
        const seenConstructs = new Set<unknown>();
        const seenNames = new Set<string>();

        const add = (record: {
            name: string;
            kind: ArtifactKind;
            origin: ArtifactOrigin;
            construct?: unknown;
            package?: string;
            file?: string;
        }) => {
            if (seenNames.has(`${record.kind}:${record.name}`)) return;
            seenNames.add(`${record.kind}:${record.name}`);
            if (record.construct) seenConstructs.add(record.construct);
            output.push({
                name: record.name,
                kind: record.kind,
                origin: record.origin === "scan" ? "scan" : "bridge",
                ...(record.package ? {package: record.package} : {}),
                ...(record.file ? {file: path.relative(workdir, record.file).split(path.sep).join("/")} : {}),
            });
        };

        for (const record of this.records()) add(record);

        for (const definition of Injection.classes.values()) {
            if (seenConstructs.has(definition.construct)) continue;
            if (seenNames.has(`di:${definition.name}`)) continue;
            const file = Injection.getArtifactPath(definition.name);
            add({
                name: definition.name,
                kind: "di",
                origin: "scan",
                construct: definition.construct,
                ...(file ? {file} : {}),
            });
        }

        return output.sort((left, right) =>
            `${left.origin}:${left.kind}:${left.name}`.localeCompare(`${right.origin}:${right.kind}:${right.name}`));
    }
}
