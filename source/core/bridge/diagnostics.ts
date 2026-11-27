import {ERROR_CATALOG, errorDocsUrl} from "../../framework/errors/catalog.ts";
import {HttpStatus} from "../../framework/enums/http-status.enum.ts";
import type {BridgeDiagnostic, BridgeDiagnosticSeverity} from "../../types/bridge.ts";

export const BRIDGE_DOCS_PATH = "user-guide/artifact-bridge.md";

export interface BridgeDiagnosticDefinition {
    severity: BridgeDiagnosticSeverity;
    message: string;
    action: string;
}

/**
 * Stable bridge diagnostic codes. Codes are additive and never renamed so CLI
 * output, tests and documentation links stay valid across releases.
 */
export const BRIDGE_DIAGNOSTICS: Record<string, BridgeDiagnosticDefinition> = {
    BRIDGE_FILE_NOT_FOUND: {
        severity: "error",
        message: "The configured artifacts bridge file was not found",
        action: "Create the file or fix `artifacts.bridge` in raiton.config.*.",
    },
    BRIDGE_FILE_INVALID_EXPORT: {
        severity: "error",
        message: "The artifacts bridge does not export a valid definition",
        action: "Export `defineArtifactBridge({ artifacts: [...] })` as the default export.",
    },
    BRIDGE_IMPORT_FAILED: {
        severity: "error",
        message: "The artifacts bridge module failed to load",
        action: "Fix the import error reported by the runtime, then retry.",
    },
    BRIDGE_MODULE_NOT_FOUND: {
        severity: "error",
        message: "A bridge module specifier could not be resolved",
        action: "Check the package name, local path and that the dependency is installed.",
    },
    BRIDGE_ENTRY_INVALID: {
        severity: "error",
        message: "A bridge entry is not a supported declaration",
        action: "Use a decorated class/function, a module specifier, a local path, or a middleware/hook/plugin descriptor.",
    },
    BRIDGE_ARTIFACT_NOT_FOUND: {
        severity: "error",
        message: "The declared module does not expose a decorated artifact",
        action: "Export a decorated controller/socket/MCP/scheduler/injectable, or remove the entry.",
    },
    BRIDGE_ARTIFACT_AMBIGUOUS: {
        severity: "error",
        message: "A bridge entry is ambiguous",
        action: "Decorate the class or use `{ middleware }`, `{ hook }` or `{ plugin }` explicitly.",
    },
    BRIDGE_ARTIFACT_DUPLICATE: {
        severity: "info",
        message: "The same bridge artifact is declared more than once",
        action: "Remove the duplicate declaration; only the first one is mounted.",
    },
    BRIDGE_NAME_COLLISION: {
        severity: "error",
        message: "Two different classes share the same injection name",
        action: "Rename one class or use `@Injectable(lifetime, \"unique:name\")`.",
    },
    BRIDGE_ABI_MISMATCH: {
        severity: "error",
        message: "A package embeds an incompatible copy of Raiton",
        action: "Declare `raiton` in `peerDependencies`, remove it from `dependencies`, and rebuild the package.",
    },
    BRIDGE_RUNTIME_UNSUPPORTED: {
        severity: "error",
        message: "The bridge entry cannot run on the current runtime",
        action: "Compile the package/file to JavaScript or use a runtime that supports TypeScript.",
    },
    BRIDGE_NOT_BUNDLED: {
        severity: "error",
        message: "The artifacts bridge has not been compiled for this production runtime",
        action: "Run `raiton build` before `raiton start` or the inspection command.",
    },
    BRIDGE_PACKAGE_FIELD_INVALID: {
        severity: "error",
        message: "A package declares an invalid `package.json#raiton.artifacts` field",
        action: "Use a string, an array of strings, or a bridge definition object.",
    },
    BRIDGE_HOOK_UNKNOWN: {
        severity: "error",
        message: "A bridge hook name is not supported",
        action: "Use one of: onRequest, preParsing, preHandler, onSend, onResponse.",
    },
    BRIDGE_DUPLICATE_MOUNT: {
        severity: "info",
        message: "The artifact was already mounted by the suffix scan",
        action: "Remove the bridge entry if the scan already covers the file.",
    },
};

export const SUPPORTED_HOOK_NAMES = [
    "onRequest",
    "preParsing",
    "preHandler",
    "onSend",
    "onResponse",
] as const;

// Bridge diagnostics are part of the stable public error catalogue so HTTP
// payloads and CLI diagnostics share the same code, hint and docs URL.
for (const [code, definition] of Object.entries(BRIDGE_DIAGNOSTICS)) {
    if (ERROR_CATALOG[code]) continue;
    ERROR_CATALOG[code] = {
        code,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: definition.message,
        docsPath: BRIDGE_DOCS_PATH,
        hint: definition.action,
    };
}

export interface BridgeDiagnosticOptions {
    message?: string;
    action?: string;
    location?: string;
    entry?: string;
    module?: string;
    package?: string;
    severity?: BridgeDiagnosticSeverity;
}

export function bridgeDiagnostic(
    code: string,
    options: BridgeDiagnosticOptions = {},
): BridgeDiagnostic {
    const definition = BRIDGE_DIAGNOSTICS[code] ?? BRIDGE_DIAGNOSTICS.BRIDGE_ENTRY_INVALID;
    return {
        code,
        severity: options.severity ?? definition.severity,
        message: options.message ?? definition.message,
        action: options.action ?? definition.action,
        docsUrl: errorDocsUrl(BRIDGE_DOCS_PATH),
        ...(options.location ? {location: options.location} : {}),
        ...(options.entry ? {entry: options.entry} : {}),
        ...(options.module ? {module: options.module} : {}),
        ...(options.package ? {package: options.package} : {}),
    };
}

/**
 * Error thrown by the bridge loader and the builders. The `code` is stable and
 * is reused by `raiton doctor` and the CLI error envelope.
 */
export class BridgeError extends Error {
    public readonly code: string;
    public readonly diagnostic: BridgeDiagnostic;
    public readonly entry?: string;
    public readonly module?: string;

    constructor(code: string, options: BridgeDiagnosticOptions = {}) {
        const diagnostic = bridgeDiagnostic(code, options);
        super(diagnostic.message);
        this.name = "BridgeError";
        this.code = code;
        this.diagnostic = diagnostic;
        this.entry = options.entry;
        this.module = options.module;
    }

    toJSON() {
        return {
            code: this.code,
            message: this.message,
            action: this.diagnostic.action,
            docsUrl: this.diagnostic.docsUrl,
            ...(this.diagnostic.location ? {location: this.diagnostic.location} : {}),
            ...(this.diagnostic.entry ? {entry: this.diagnostic.entry} : {}),
            ...(this.diagnostic.module ? {module: this.diagnostic.module} : {}),
        };
    }
}
