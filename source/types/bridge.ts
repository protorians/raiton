import type {ConstructorType} from "./contruct.ts";
import type {HookHandlerCallable, HookNameType} from "./core.ts";
import type {MiddlewareType} from "./middleware.ts";
import type {PluginInterface} from "./plugin.ts";
import type {Route} from "../core/router/route.ts";

/**
 * Semantic kind of an artifact resolved by the framework.
 *
 * `di` covers services, repositories and any other injectable class. The
 * remaining kinds match the existing compilers and application pipelines.
 */
export type ArtifactKind =
    | "controller"
    | "socket"
    | "mcp"
    | "scheduler"
    | "di"
    | "middleware"
    | "hook"
    | "plugin";

/** Where an artifact came from. */
export type ArtifactOrigin = "scan" | "bridge" | "package";

export interface MiddlewareBridgeDescriptor {
    middleware: MiddlewareType | ConstructorType;
    /** Stable name used for replacement and removal. Defaults to the function name. */
    name?: string;
    /**
     * Relative order between bridge middleware. In v1, declarations are
     * mounted in the order they appear in `artifacts`; `order` is reserved for
     * future finer-grained ordering and may be omitted.
     */
    order?: number;
}

export interface HookBridgeDescriptor {
    hook: HookNameType;
    handler: HookHandlerCallable;
    name?: string;
}

export interface PluginBridgeDescriptor {
    plugin: PluginInterface;
    name?: string;
}

/**
 * A bridge entry is intentionally explicit: a decorated class/function, a
 * module or local path, or one of the application descriptor forms.
 */
export type ArtifactBridgeEntry =
    | ConstructorType
    | string
    | MiddlewareBridgeDescriptor
    | HookBridgeDescriptor
    | PluginBridgeDescriptor;

export interface ArtifactBridgeDefinition {
    /** Declarative allowlist of artifacts to mount. */
    artifacts: ArtifactBridgeEntry[];
    /** Additive metadata; ignored by the v1 loader. */
    [key: string]: unknown;
}

export interface ResolvedBridgeArtifact {
    name: string;
    kind: ArtifactKind;
    construct?: unknown;
    origin: "bridge" | "package";
    package?: string;
    file?: string;
    middleware?: MiddlewareType;
    middlewareName?: string;
    hook?: HookNameType;
    handler?: HookHandlerCallable;
    plugin?: PluginInterface;
    routes?: Route[];
}

export interface UnresolvedBridgeArtifact {
    entry: unknown;
    reason: string;
    code?: string;
    package?: string;
    file?: string;
}

export interface ArtifactBridgeDescriptor {
    /** Bridge file as declared by the project (source path when available). */
    readonly file: string;
    /** Runtime file actually imported (compiled file on Node production). */
    readonly runtimeFile?: string;
    readonly loaded: boolean;
    readonly packages: string[];
    readonly artifacts: ResolvedBridgeArtifact[];
    readonly unresolved: UnresolvedBridgeArtifact[];
    readonly localFiles: string[];
}

export interface BridgeManifestArtifact {
    name: string;
    kind: ArtifactKind;
    origin: "scan" | "bridge";
    package?: string;
    file?: string;
}

export interface BridgeManifestSection {
    file: string | null;
    loaded: boolean;
    packages: string[];
    artifacts: BridgeManifestArtifact[];
    unresolved: Array<{
        entry: string;
        reason: string;
        code?: string;
        package?: string;
        file?: string;
    }>;
}

export type BridgeDiagnosticSeverity = "error" | "warning" | "info";

export interface BridgeDiagnostic {
    code: string;
    severity: BridgeDiagnosticSeverity;
    message: string;
    action: string;
    docsUrl: string;
    location?: string;
    entry?: string;
    module?: string;
    package?: string;
}
