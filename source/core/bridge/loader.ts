import fs from "node:fs";
import path from "node:path";
import {Logger} from "@protorians/logger";
import {Injection} from "../injection/injection.ts";
import {Raiton} from "../raiton.ts";
import {RaitonConfig} from "../config/config.ts";
import {isNodeUsed} from "../../bin/constants.ts";
import type {ApplicationInterface} from "../../types/application.ts";
import type {
    ArtifactBridgeDefinition,
    ArtifactBridgeDescriptor,
    ArtifactBridgeEntry,
    BridgeDiagnostic,
    HookBridgeDescriptor,
    MiddlewareBridgeDescriptor,
    PluginBridgeDescriptor,
    ResolvedBridgeArtifact,
} from "../../types/bridge.ts";
import {ArtifactRegistry, artifactKey, type MountedArtifactRecord} from "./registry.ts";
import {classifyConstruct, exportNames, isBridgeDefinition, isClass, resolveArtifacts} from "./classifier.ts";
import {BridgeError, bridgeDiagnostic, SUPPORTED_HOOK_NAMES} from "./diagnostics.ts";
import {
    importBridgeModule,
    isLocalPathSpecifier,
    packageNameFromSpecifier,
    resolveBridgeModule,
    type ResolvedBridgeModule,
} from "./resolver.ts";
import {
    compiledBridgeFile,
    relativeTo,
    resolveRuntimeBridge,
} from "./paths.ts";
import {discoverPackageArtifacts} from "./packages.ts";
import {mountArtifact} from "../artifact-mount.ts";
import {ControllerRouteTracker} from "../controller/tracker.ts";
import {McpRouteTracker} from "../mcp/tracker.ts";
import {getSocketMetadata, unregisterSocket} from "../socket/metadata.ts";
import {unregisterMcpServer} from "../mcp/metadata.ts";
import {unregisterScheduler, getSchedulerMetadata} from "../scheduler/metadata.ts";
import {SchedulerManager} from "../scheduler/manager.ts";
import {MiddlewarePipeline} from "../middleware/pipeline.ts";
import {HookStore} from "../hooks.ts";

export interface BridgeLoadOptions {
    workdir?: string;
    development?: boolean;
    /** Force a cache-busting import of local bridge modules. */
    cacheBust?: boolean;
}

export interface BridgeState {
    descriptor: ArtifactBridgeDescriptor | null;
    sourceFile: string | null;
    runtimeFile: string | null;
    loaded: boolean;
    disabled: boolean;
    missing: boolean;
    packages: string[];
    artifacts: ResolvedBridgeArtifact[];
    unresolved: ArtifactBridgeDescriptor["unresolved"];
    diagnostics: BridgeDiagnostic[];
    localFiles: string[];
}

export interface EntryContext {
    origin: "bridge" | "package";
    package?: string;
    directories: Array<string | undefined>;
    cacheBust: boolean;
    location?: string;
    packageRoot?: string;
}

const EMPTY_STATE: BridgeState = {
    descriptor: null,
    sourceFile: null,
    runtimeFile: null,
    loaded: false,
    disabled: false,
    missing: false,
    packages: [],
    artifacts: [],
    unresolved: [],
    diagnostics: [],
    localFiles: [],
};

function developmentMode(options: BridgeLoadOptions): boolean {
    if (options.development !== undefined) return options.development;
    const thread = Raiton.thread as any;
    return Boolean(
        RaitonConfig.get("develop")
        || thread?.builder?.options?.hmr
        || thread?.builder?.options?.serve
        || process.env.NODE_ENV === "development"
    );
}

function describeEntry(entry: unknown): string {
    if (typeof entry === "string") return entry;
    if (typeof entry === "function") return entry.name || "anonymous function";
    if (entry && typeof entry === "object") {
        const kind = ["middleware", "hook", "plugin"].find(key => key in (entry as any));
        if (kind) return `${kind}(${(entry as any)[kind]?.name ?? "anonymous"})`;
        return Object.keys(entry as object).join(",") || "object";
    }
    return String(entry);
}

function isDescriptor(value: unknown): boolean {
    return Boolean(value)
        && typeof value === "object"
        && ["middleware", "hook", "plugin"].some(key => key in (value as any));
}

export class BridgeLoader {
    protected static _state: BridgeState = {...EMPTY_STATE};

    static get state(): BridgeState {
        return this._state;
    }

    static get current(): ArtifactBridgeDescriptor | null {
        return this._state.descriptor;
    }

    static async reset(): Promise<void> {
        this._state = {...EMPTY_STATE};
        ArtifactRegistry.setExcludedFiles([]);
    }

    /**
     * Resolve, import and validate the bridge. This never mounts artifacts and
     * never throws for a missing default bridge file.
     */
    static async load(options: BridgeLoadOptions = {}): Promise<BridgeState> {
        const workdir = options.workdir ?? process.cwd();
        const development = developmentMode(options);
        const resolution = resolveRuntimeBridge(workdir);

        this._state = {
            ...EMPTY_STATE,
            sourceFile: resolution.file,
            runtimeFile: resolution.runtimeFile,
            disabled: resolution.disabled,
            missing: Boolean(resolution.explicit && !resolution.file),
        };

        const artifacts: ResolvedBridgeArtifact[] = [];
        const unresolved: ArtifactBridgeDescriptor["unresolved"] = [];
        const diagnostics: BridgeDiagnostic[] = [];
        const seen = new Map<unknown, ResolvedBridgeArtifact>();
        const logical = new Map<string, ResolvedBridgeArtifact>();

        const register = (artifact: ResolvedBridgeArtifact) => {
            const identity = this.identityOf(artifact);
            const duplicate = seen.get(identity);
            if (duplicate) {
                diagnostics.push(bridgeDiagnostic("BRIDGE_ARTIFACT_DUPLICATE", {
                    entry: artifact.name,
                    message: `Bridge artifact "${artifact.name}" is declared more than once`,
                }));
                return;
            }

            // A class imported statically by the bridge and resolved again from
            // a module string has two identities but one logical artifact. Keep
            // the located copy (file/package metadata) and never mount both.
            const logicalKey = `${artifact.kind}|${artifact.name}|${artifact.package ?? ""}`;
            const existing = logical.get(logicalKey);
            if (existing) {
                if (existing.construct === artifact.construct) {
                    diagnostics.push(bridgeDiagnostic("BRIDGE_ARTIFACT_DUPLICATE", {
                        entry: artifact.name,
                        message: `Bridge artifact "${artifact.name}" is declared more than once`,
                    }));
                    return;
                }
                if (existing.file && artifact.file && existing.file !== artifact.file) {
                    throw new BridgeError("BRIDGE_NAME_COLLISION", {
                        message: `Bridge artifact "${artifact.name}" is declared from two different files`,
                        action: "Use a unique class name or remove the duplicate declaration.",
                        location: artifact.file,
                        entry: artifact.name,
                        package: artifact.package,
                    });
                }
                if (!existing.file && artifact.file) {
                    const index = artifacts.indexOf(existing);
                    if (index !== -1) artifacts[index] = artifact;
                    seen.delete(this.identityOf(existing));
                    logical.set(logicalKey, artifact);
                    seen.set(identity, artifact);
                    return;
                }
                diagnostics.push(bridgeDiagnostic("BRIDGE_ARTIFACT_DUPLICATE", {
                    entry: artifact.name,
                    message: `Bridge artifact "${artifact.name}" is declared more than once`,
                }));
                return;
            }

            seen.set(identity, artifact);
            logical.set(logicalKey, artifact);
            artifacts.push(artifact);
        };

        let definition: ArtifactBridgeDefinition | null = null;
        let runtimeFile: string | null = resolution.runtimeFile;
        let descriptorFile: string | null = null;
        let baseDirectories: Array<string | undefined> = [resolution.rootDir, workdir];

        if (!resolution.disabled && !resolution.file && resolution.explicit) {
            const message = `Configured artifacts bridge was not found: ${resolution.expected}`;
            if (development) {
                const diagnostic = bridgeDiagnostic("BRIDGE_FILE_NOT_FOUND", {
                    severity: "warning",
                    message,
                    location: resolution.expected ?? workdir,
                });
                diagnostics.push(diagnostic);
                Logger.warn(`[bridge] ${message}`);
            } else {
                throw new BridgeError("BRIDGE_FILE_NOT_FOUND", {
                    message,
                    location: resolution.expected ?? workdir,
                    entry: resolution.expected ?? undefined,
                });
            }
        } else if (!resolution.disabled && resolution.file) {
            if (isNodeUsed && !fs.existsSync(compiledBridgeFile(workdir))) {
                throw new BridgeError("BRIDGE_NOT_BUNDLED", {
                    message: `The artifacts bridge has not been compiled for Node.js: ${relativeTo(workdir, resolution.file)}`,
                    location: resolution.file,
                    entry: relativeTo(workdir, resolution.file),
                    action: "Run `raiton build` first, then start the compiled application.",
                });
            }

            runtimeFile = resolution.runtimeFile ?? resolution.file;
            descriptorFile = relativeTo(workdir, resolution.file) ?? resolution.file;
            baseDirectories = [path.dirname(resolution.file), resolution.rootDir, workdir];

            const imported = await importBridgeModule({
                file: runtimeFile,
                package: undefined,
                external: runtimeFile.includes(`${path.sep}node_modules${path.sep}`),
            }, {cacheBust: Boolean(options.cacheBust && !isNodeUsed)});

            definition = this.definitionFrom(imported, runtimeFile);
            const context: EntryContext = {
                origin: "bridge",
                directories: baseDirectories,
                cacheBust: Boolean(options.cacheBust && !isNodeUsed),
                location: descriptorFile,
            };
            const resolved = await this.resolveEntries(definition.artifacts, context, {diagnostics, unresolved});
            for (const artifact of resolved) register(artifact);
        }

        // Package self-description is independent from the bridge file: a
        // direct dependency declaring `package.json#raiton.artifacts` is
        // discovered even when the project has no bridge file.
        const packageDiscovery = discoverPackageArtifacts(workdir, {
            enabled: RaitonConfig.get("artifacts")?.packages ?? true,
            allowlist: RaitonConfig.get("artifacts")?.packageAllowlist,
            verbose: Boolean(RaitonConfig.get("verbose")),
        });
        diagnostics.push(...packageDiscovery.diagnostics);

        const fatal = packageDiscovery.diagnostics.find(diagnostic => diagnostic.severity === "error");
        if (fatal) {
            throw new BridgeError(fatal.code, {
                message: fatal.message,
                action: fatal.action,
                location: fatal.location,
                package: fatal.package,
            });
        }

        for (const entry of packageDiscovery.entries) {
            const packageContext: EntryContext = {
                origin: "package",
                package: entry.package,
                packageRoot: entry.packageRoot,
                directories: [entry.packageRoot, ...baseDirectories],
                cacheBust: Boolean(options.cacheBust && !isNodeUsed),
                location: entry.location,
            };
            const packageResolved = await this.resolveEntries([entry.entry], packageContext, {diagnostics, unresolved});
            for (const artifact of packageResolved) register(artifact);
        }

        const localFiles = artifacts
            .map(artifact => artifact.file)
            .filter((file): file is string => Boolean(file) && !file!.includes(`${path.sep}node_modules${path.sep}`));

        ArtifactRegistry.setExcludedFiles(localFiles);

        const loaded = Boolean(definition) || artifacts.length > 0;

        this._state = {
            descriptor: definition && descriptorFile
                ? {
                    file: descriptorFile,
                    runtimeFile: relativeTo(workdir, runtimeFile),
                    loaded: true,
                    packages: packageDiscovery.packages,
                    artifacts,
                    unresolved,
                    localFiles,
                }
                : null,
            sourceFile: resolution.file,
            runtimeFile,
            loaded,
            disabled: resolution.disabled,
            missing: Boolean(resolution.explicit && !resolution.file),
            packages: packageDiscovery.packages,
            artifacts,
            unresolved,
            diagnostics,
            localFiles,
        };

        if (loaded) {
            const summary = `[bridge] ${artifacts.length} artifact(s), ${packageDiscovery.packages.length} package(s), ${diagnostics.filter(d => d.severity !== "info").length} warning(s)`;
            if (RaitonConfig.get("verbose")) Logger.info(summary);
        }
        return this._state;
    }

    /**
     * Mount every resolved artifact through the existing pipelines. Idempotent
     * against the scan and against repeated calls.
     */
    static async mount(application: ApplicationInterface): Promise<BridgeLoader> {
        if (!this._state.loaded) return this;
        this.adoptAll(this._state.artifacts);
        for (const artifact of this._state.artifacts) {
            await this.mountArtifact(artifact, application, true);
        }
        return this;
    }

    /**
     * Development hot reload: load the new manifest, diff by stable key and
     * reconcile bridge-owned routes/middleware/hooks only.
     */
    static async reload(options: BridgeLoadOptions = {}): Promise<BridgeState> {
        const thread = Raiton.thread as any;
        const application = thread?.application as ApplicationInterface | undefined;
        if (!application) return this._state;

        if (isNodeUsed) {
            thread?.restart?.();
            return this._state;
        }

        const previous = this._state;
        const previousArtifacts = [...previous.artifacts];
        let nextState: BridgeState;
        try {
            nextState = await this.load({...options, cacheBust: true, development: true});
        } catch (error) {
            // A broken edit must not discard the working bridge in development.
            this._state = previous;
            ArtifactRegistry.setExcludedFiles(previous.localFiles);
            throw error;
        }
        if (!nextState.loaded) {
            for (const artifact of previousArtifacts) {
                this.unmountArtifact(this.mountedRecord(artifact), application);
            }
            return nextState;
        }

        const previousByKey = new Map(previousArtifacts.map(artifact => [this.stableKey(artifact), artifact]));
        const nextByKey = new Map(nextState.artifacts.map(artifact => [this.stableKey(artifact), artifact]));

        const removed: ResolvedBridgeArtifact[] = [];
        const updated: ResolvedBridgeArtifact[] = [];
        for (const [key, previousArtifact] of previousByKey) {
            const nextArtifact = nextByKey.get(key);
            if (!nextArtifact) {
                removed.push(previousArtifact);
                continue;
            }
            if (this.identityOf(previousArtifact) !== this.identityOf(nextArtifact)) {
                updated.push(nextArtifact);
            }
        }

        for (const artifact of removed) {
            this.unmountArtifact(this.mountedRecord(artifact), application);
        }
        for (const artifact of updated) {
            this.unmountArtifact(this.mountedRecord(artifact), application);
        }

        // Hot-reloaded classes have new identities but keep their injection
        // name. Replace owned definitions before adoption re-checks collisions.
        for (const artifact of updated) {
            if (typeof artifact.construct === "function" && Injection.has(artifact.name)) {
                Injection.replace(artifact.name, artifact.construct as any);
            }
        }

        // Adopt every injectable before compiling any controller: declaration
        // order must not make a service unavailable to an earlier controller.
        this.adoptAll(nextState.artifacts);

        const updatedKeys = new Set(updated.map(artifact => this.stableKey(artifact)));
        for (const artifact of nextState.artifacts) {
            const key = this.stableKey(artifact);
            const previousArtifact = previousByKey.get(key);
            const changed = !previousArtifact || updatedKeys.has(key)
                || this.identityOf(previousArtifact) !== this.identityOf(artifact);
            if (changed) await this.mountArtifact(artifact, application, true);
        }

        if (RaitonConfig.get("verbose")) {
            Logger.info(`[bridge] reloaded: +${nextState.artifacts.length - previousArtifacts.length} -${removed.length} ~${updated.length}`);
        }
        return nextState;
    }

    /**
     * Non-throwing checks used by `raiton doctor`.
     */
    static diagnose(workdir = process.cwd()): BridgeDiagnostic[] {
        const diagnostics: BridgeDiagnostic[] = [];
        const resolution = resolveRuntimeBridge(workdir);

        if (typeof (Reflect as any).getMetadata !== "function") {
            diagnostics.push(bridgeDiagnostic("BRIDGE_RUNTIME_UNSUPPORTED", {
                message: "reflect-metadata is not loaded in this runtime",
                action: "Import `reflect-metadata` at the top of the application entry point.",
            }));
        }

        if (resolution.disabled) return diagnostics;

        if (resolution.explicit && !resolution.file) {
            diagnostics.push(bridgeDiagnostic("BRIDGE_FILE_NOT_FOUND", {
                location: resolution.expected ?? workdir,
            }));
        } else if (resolution.file && isNodeUsed && !fs.existsSync(compiledBridgeFile(workdir))) {
            diagnostics.push(bridgeDiagnostic("BRIDGE_NOT_BUNDLED", {
                location: resolution.file,
                entry: relativeTo(workdir, resolution.file),
            }));
        }

        const packageDiscovery = discoverPackageArtifacts(workdir, {
            enabled: RaitonConfig.get("artifacts")?.packages ?? true,
            allowlist: RaitonConfig.get("artifacts")?.packageAllowlist,
        });
        diagnostics.push(...packageDiscovery.diagnostics);

        for (const diagnostic of this._state.diagnostics) {
            if (!diagnostics.some(existing => existing.code === diagnostic.code && existing.message === diagnostic.message)) {
                diagnostics.push(diagnostic);
            }
        }

        return diagnostics;
    }

    protected static definitionFrom(imported: any, runtimeFile: string): ArtifactBridgeDefinition {
        const candidate = imported?.default ?? imported;
        if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.artifacts)) {
            throw new BridgeError("BRIDGE_FILE_INVALID_EXPORT", {
                message: `The artifacts bridge must default-export defineArtifactBridge({ artifacts: [...] }) (${relativeTo(process.cwd(), runtimeFile) ?? runtimeFile})`,
                location: runtimeFile,
                entry: relativeTo(process.cwd(), runtimeFile),
            });
        }
        return {
            ...candidate,
            artifacts: candidate.artifacts,
        } as ArtifactBridgeDefinition;
    }

    protected static async resolveEntries(
        entries: ArtifactBridgeEntry[],
        context: EntryContext,
        state: {
            diagnostics: BridgeDiagnostic[];
            unresolved: ArtifactBridgeDescriptor["unresolved"];
        },
        depth = 0,
    ): Promise<ResolvedBridgeArtifact[]> {
        if (depth > 8) {
            throw new BridgeError("BRIDGE_FILE_INVALID_EXPORT", {
                message: "Bridge definitions are nested too deeply",
                location: context.location,
            });
        }

        const output: ResolvedBridgeArtifact[] = [];

        for (const entry of entries) {
            if (typeof entry === "string") {
                output.push(...await this.resolveModuleEntry(entry, context, state, depth));
                continue;
            }

            if (typeof entry === "function") {
                const classified = classifyConstruct(entry);
                if (!classified) {
                    throw new BridgeError("BRIDGE_ARTIFACT_AMBIGUOUS", {
                        message: `Bridge entry "${entry.name || "anonymous"}" is a function without artifact metadata or descriptor`,
                        action: "Decorate the class, or declare it as `{ middleware }`, `{ hook }` or `{ plugin }`.",
                        location: context.location,
                        entry: entry.name || "anonymous",
                    });
                }
                output.push({
                    name: classified.name,
                    kind: classified.kind,
                    construct: entry,
                    origin: context.origin,
                    ...(context.package ? {package: context.package} : {}),
                    ...(this.fileForConstruct(entry) ? {file: this.fileForConstruct(entry)!} : {}),
                });
                continue;
            }

            if (entry && typeof entry === "object") {
                if (isBridgeDefinition(entry)) {
                    output.push(...await this.resolveEntries(
                        (entry as ArtifactBridgeDefinition).artifacts,
                        context,
                        state,
                        depth + 1,
                    ));
                    continue;
                }
                output.push(this.resolveDescriptor(entry as any, context));
                continue;
            }

            throw new BridgeError("BRIDGE_ENTRY_INVALID", {
                message: `Unsupported bridge entry: ${describeEntry(entry)}`,
                action: "Use a decorated class/function, a module specifier, a local path, or a middleware/hook/plugin descriptor.",
                location: context.location,
                entry: describeEntry(entry),
            });
        }

        return output;
    }

    protected static async resolveModuleEntry(
        specifier: string,
        context: EntryContext,
        state: {
            diagnostics: BridgeDiagnostic[];
            unresolved: ArtifactBridgeDescriptor["unresolved"];
        },
        depth: number,
    ): Promise<ResolvedBridgeArtifact[]> {
        const resolved: ResolvedBridgeModule = resolveBridgeModule(specifier, {
            directories: context.directories,
            workdir: context.directories[context.directories.length - 1] ?? process.cwd(),
        });

        if (resolved.file.startsWith("node:")) {
            throw new BridgeError("BRIDGE_MODULE_NOT_FOUND", {
                message: `Runtime builtins cannot expose bridge artifacts: ${specifier}`,
                entry: specifier,
                module: specifier,
            });
        }

        if (isNodeUsed && /\.(ts|mts|cts|tsx)$/i.test(resolved.file)) {
            throw new BridgeError("BRIDGE_RUNTIME_UNSUPPORTED", {
                message: `Bridge local entry is TypeScript but the current runtime cannot import it: ${specifier}`,
                action: "Import the class directly in the bridge (recommended) or compile the file to JavaScript.",
                location: resolved.file,
                entry: specifier,
            });
        }

        if (isLocalPathSpecifier(specifier) || !resolved.external) {
            ArtifactRegistry.excludeFile(resolved.file);
            context = {
                ...context,
                directories: [...context.directories, path.dirname(resolved.file)],
            };
        }

        const imported = await importBridgeModule(resolved, {
            // External packages are not watched: always use the runtime module
            // cache so a package class imported by the bridge and resolved
            // dynamically is the exact same object.
            cacheBust: Boolean(context.cacheBust && !resolved.external),
        });
        const candidate = imported?.default ?? imported;
        if (isBridgeDefinition(candidate)) {
            return this.resolveEntries(candidate.artifacts, {
                ...context,
                location: resolved.file,
                ...(resolved.package ? {package: resolved.package} : {}),
            }, state, depth + 1);
        }

        const artifacts = resolveArtifacts(imported);
        if (!artifacts.length) {
            throw new BridgeError("BRIDGE_ARTIFACT_NOT_FOUND", {
                message: `Module "${specifier}" exposes no decorated artifact (exports: ${exportNames(imported).join(", ") || "none"})`,
                action: "Export a decorated controller/socket/MCP/scheduler/injectable, or remove the entry.",
                location: resolved.file,
                entry: specifier,
                module: resolved.package ?? specifier,
            });
        }

        const packageName = context.package ?? resolved.package ?? packageNameFromSpecifier(specifier);
        return artifacts.map(artifact => ({
            name: artifact.name,
            kind: artifact.kind,
            construct: artifact.construct,
            origin: context.origin,
            ...(packageName ? {package: packageName} : {}),
            file: resolved.file,
        }));
    }

    protected static resolveDescriptor(
        entry: MiddlewareBridgeDescriptor | HookBridgeDescriptor | PluginBridgeDescriptor | Record<string, any>,
        context: EntryContext,
    ): ResolvedBridgeArtifact {
        const keys = ["plugin", "middleware", "hook"].filter(key => key in entry);
        if (keys.length !== 1) {
            throw new BridgeError("BRIDGE_ENTRY_INVALID", {
                message: `Ambiguous bridge descriptor: expected exactly one of middleware, hook or plugin (${describeEntry(entry)})`,
                action: "Declare `{ middleware }`, `{ hook, handler }` or `{ plugin }`.",
                location: context.location,
                entry: describeEntry(entry),
            });
        }

        if (keys[0] === "plugin") {
            const descriptor = entry as PluginBridgeDescriptor;
            if (!descriptor.plugin || typeof descriptor.plugin !== "object" || typeof descriptor.plugin.setup !== "function") {
                throw new BridgeError("BRIDGE_ENTRY_INVALID", {
                    message: "A plugin descriptor requires an object with a `setup` function",
                    action: "Pass `{ plugin: myPlugin }`.",
                    location: context.location,
                    entry: "plugin",
                });
            }
            return {
                name: descriptor.name || descriptor.plugin.name || "plugin",
                kind: "plugin",
                plugin: descriptor.plugin,
                origin: context.origin,
                ...(context.package ? {package: context.package} : {}),
            };
        }

        if (keys[0] === "hook") {
            const descriptor = entry as HookBridgeDescriptor;
            if (!SUPPORTED_HOOK_NAMES.includes(descriptor.hook as any)) {
                throw new BridgeError("BRIDGE_HOOK_UNKNOWN", {
                    message: `Unsupported bridge hook "${String(descriptor.hook)}"`,
                    action: `Use one of: ${SUPPORTED_HOOK_NAMES.join(", ")}.`,
                    location: context.location,
                    entry: String(descriptor.hook),
                });
            }
            if (typeof descriptor.handler !== "function") {
                throw new BridgeError("BRIDGE_ENTRY_INVALID", {
                    message: "A hook descriptor requires a `handler` function",
                    action: "Pass `{ hook: \"onRequest\", handler: myHook }`.",
                    location: context.location,
                    entry: "hook",
                });
            }
            return {
                name: descriptor.name || descriptor.handler.name || `bridge-${descriptor.hook}`,
                kind: "hook",
                hook: descriptor.hook,
                handler: descriptor.handler,
                origin: context.origin,
                ...(context.package ? {package: context.package} : {}),
            };
        }

        const descriptor = entry as MiddlewareBridgeDescriptor;
        const middleware = descriptor.middleware;
        if (typeof middleware !== "function" && (typeof middleware !== "object" || middleware === null)) {
            throw new BridgeError("BRIDGE_ENTRY_INVALID", {
                message: "A middleware descriptor requires a function, class or middleware object",
                action: "Pass `{ middleware: myMiddleware }`.",
                location: context.location,
                entry: "middleware",
            });
        }
        return {
            name: descriptor.name || (middleware as any).name || "middleware",
            kind: "middleware",
            ...(isClass(middleware) ? {construct: middleware} : {middleware: middleware as any}),
            origin: context.origin,
            ...(context.package ? {package: context.package} : {}),
        };
    }

    protected static adoptAll(artifacts: ResolvedBridgeArtifact[]): void {
        for (const artifact of artifacts) {
            if (typeof artifact.construct !== "function") continue;
            const adopted = Injection.adopt(artifact.construct as any);
            if (adopted.status === "collision") {
                const previousFile = adopted.existing
                    ? Injection.getArtifactPath(adopted.name)
                    : undefined;
                throw new BridgeError("BRIDGE_NAME_COLLISION", {
                    message: `Injection name "${adopted.name}" is already used by another class (${artifact.name})`,
                    action: "Rename one class or declare a unique name with @Injectable(lifetime, \"vendor:name\").",
                    location: artifact.file ?? previousFile,
                    entry: artifact.name,
                    package: artifact.package,
                });
            }
        }
    }

    protected static async mountArtifact(
        artifact: ResolvedBridgeArtifact,
        application: ApplicationInterface,
        strict: boolean,
    ): Promise<void> {
        const root: any = (application as any).root;

        if (artifact.kind === "plugin") {
            if (artifact.plugin) application.register(artifact.plugin);
            ArtifactRegistry.add({
                key: artifactKey({kind: "plugin", name: artifact.name, file: artifact.file, package: artifact.package}),
                name: artifact.name,
                kind: "plugin",
                origin: artifact.origin,
                pluginName: artifact.name,
                ...(artifact.file ? {file: artifact.file} : {}),
                ...(artifact.package ? {package: artifact.package} : {}),
            });
            return;
        }

        if (artifact.kind === "middleware") {
            const pipeline: MiddlewarePipeline | undefined = root?.middleware;
            if (!pipeline) return;
            const instance = this.middlewareInstance(artifact);
            if (this.hasMiddleware(pipeline, artifact.name, instance)) {
                this._state.diagnostics.push(bridgeDiagnostic("BRIDGE_DUPLICATE_MOUNT", {
                    entry: artifact.name,
                    message: `Middleware "${artifact.name}" is already registered`,
                }));
                return;
            }
            pipeline.use(instance as any);
            ArtifactRegistry.add({
                key: artifactKey({kind: "middleware", name: artifact.name, file: artifact.file, package: artifact.package}),
                name: artifact.name,
                kind: "middleware",
                origin: artifact.origin,
                construct: artifact.construct,
                middlewareName: artifact.name,
                handler: instance as any,
                ...(artifact.file ? {file: artifact.file} : {}),
                ...(artifact.package ? {package: artifact.package} : {}),
            });
            return;
        }

        if (artifact.kind === "hook") {
            const hooks: HookStore | undefined = root?.hooks;
            if (!hooks || !artifact.hook || !artifact.handler) return;
            if (hooks.hasHandler?.(artifact.hook, artifact.handler)) {
                this._state.diagnostics.push(bridgeDiagnostic("BRIDGE_DUPLICATE_MOUNT", {
                    entry: artifact.name,
                    message: `Hook "${artifact.hook}" handler is already registered`,
                }));
                return;
            }
            hooks.add(artifact.hook, artifact.handler);
            ArtifactRegistry.add({
                key: artifactKey({kind: "hook", name: artifact.name, file: artifact.file, package: artifact.package}),
                name: artifact.name,
                kind: "hook",
                origin: artifact.origin,
                hookName: artifact.hook,
                handler: artifact.handler,
                ...(artifact.file ? {file: artifact.file} : {}),
                ...(artifact.package ? {package: artifact.package} : {}),
            });
            return;
        }

        const construct = artifact.construct;
        if (typeof construct !== "function") {
            throw new BridgeError("BRIDGE_ARTIFACT_NOT_FOUND", {
                message: `Bridge artifact "${artifact.name}" has no construct and cannot be mounted`,
                entry: artifact.name,
                location: artifact.file,
            });
        }

        if (ArtifactRegistry.hasConstruct(construct)) {
            this._state.diagnostics.push(bridgeDiagnostic("BRIDGE_DUPLICATE_MOUNT", {
                entry: artifact.name,
                message: `Artifact "${artifact.name}" is already mounted`,
            }));
            return;
        }

        await mountArtifact(construct as any, artifact.kind, application, {
            origin: artifact.origin,
            file: artifact.file,
            package: artifact.package,
            strictInjectables: strict,
        });
    }

    protected static unmountArtifact(
        record: MountedArtifactRecord | undefined,
        application: ApplicationInterface,
    ): void {
        if (!record) return;
        const root: any = (application as any).root;

        if (record.kind === "controller") {
            ControllerRouteTracker.removeRoutes(record.name, root?.router, "bridge", `bridge:${record.name}`);
            Injection.invalidateCascade(record.name);
        } else if (record.kind === "mcp") {
            McpRouteTracker.removeRoutes(record.name, root?.router);
            unregisterMcpServer(record.name);
            Injection.invalidateCascade(record.name);
        } else if (record.kind === "socket") {
            const metadata = record.construct ? getSocketMetadata((record.construct as any).prototype ?? record.construct) : undefined;
            if (metadata?.namespace) unregisterSocket(metadata.namespace);
            Injection.invalidateCascade(record.name);
        } else if (record.kind === "scheduler") {
            unregisterScheduler(record.name);
            const metadata = record.construct
                ? getSchedulerMetadata((record.construct as any).prototype ?? record.construct)
                : undefined;
            if (metadata?.jobs?.length) {
                SchedulerManager.current.unregister?.(metadata.jobs.map(job => job.name));
            }
            Injection.invalidateCascade(record.name);
        } else if (record.kind === "middleware") {
            if (record.handler) {
                root?.middleware?.remove(record.handler as any);
            } else if (record.middlewareName) {
                root?.middleware?.remove(record.middlewareName);
            }
        } else if (record.kind === "hook") {
            if (record.hookName && record.handler) root?.hooks?.remove(record.hookName, record.handler);
        } else if (record.kind === "di") {
            const definition = Injection.definition(record.name);
            if (definition?.construct === record.construct) {
                Injection.unregister(record.name);
            } else {
                Injection.invalidateCascade(record.name);
            }
        }

        ArtifactRegistry.remove(record.key);
    }

    protected static mountedRecord(artifact: ResolvedBridgeArtifact): MountedArtifactRecord | undefined {
        return ArtifactRegistry.getByKey(this.stableKey(artifact));
    }

    protected static stableKey(artifact: ResolvedBridgeArtifact): string {
        return artifactKey({
            kind: artifact.kind,
            name: artifact.name,
            file: artifact.file,
            package: artifact.package,
        });
    }

    protected static identityOf(artifact: ResolvedBridgeArtifact): unknown {
        return artifact.construct ?? artifact.handler
            ?? artifact.plugin ?? artifact.middleware ?? artifact.name;
    }

    protected static fileForConstruct(construct: unknown): string | undefined {
        if (typeof construct !== "function") return undefined;
        return Injection.getArtifactPath((construct as any).name);
    }

    protected static middlewareInstance(artifact: ResolvedBridgeArtifact): any {
        const candidate: any = artifact.construct ?? artifact.middleware;
        if (artifact.construct && isClass(artifact.construct)) {
            try {
                return Injection.resolve(artifact.construct as any);
            } catch {
                return new (artifact.construct as any)();
            }
        }
        return candidate;
    }

    protected static hasMiddleware(pipeline: MiddlewarePipeline, name: string, instance: any): boolean {
        if (pipeline.has?.(instance)) return true;
        if (name && pipeline.hasName?.(name)) return true;
        return false;
    }
}
