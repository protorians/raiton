import {t} from "../contracts/typebox.ts";
import {Value} from "@sinclair/typebox/value";

export const MANIFEST_SCHEMA_VERSION = "1.0.0";
export const SUPPORTED_MANIFEST_SCHEMA_VERSIONS = new Set([MANIFEST_SCHEMA_VERSION]);

const SchemaRecord = t.record(t.string(), t.any());

export const RouteExampleSchema = t.object({
    name: t.string(),
    body: t.optional(t.any()),
    params: t.optional(SchemaRecord),
    query: t.optional(SchemaRecord),
    headers: t.optional(SchemaRecord),
    expectedStatus: t.optional(t.number()),
});

export const RouteErrorSchema = t.object({
    code: t.string(),
    status: t.number(),
    description: t.optional(t.string()),
});

export const RouteManifestSchema = t.object({
    method: t.string(),
    path: t.string(),
    version: t.optional(t.string()),
    controller: t.string(),
    handler: t.string(),
    file: t.string(),
    line: t.number(),
    origin: t.optional(t.union([t.literal("scan"), t.literal("bridge")])),
    package: t.optional(t.string()),
    input: t.optional(t.string()),
    output: t.optional(t.string()),
    inputSchema: t.optional(SchemaRecord),
    outputSchema: t.optional(SchemaRecord),
    querySchema: t.optional(SchemaRecord),
    paramsSchema: t.optional(SchemaRecord),
    headersSchema: t.optional(SchemaRecord),
    examples: t.optional(t.array(RouteExampleSchema)),
    errors: t.optional(t.array(RouteErrorSchema)),
}, {additionalProperties: true});

export const McpToolManifestSchema = t.object({
    name: t.string(),
    description: t.optional(t.string()),
    file: t.optional(t.string()),
    line: t.optional(t.number()),
    inputSchema: t.optional(SchemaRecord),
    outputSchema: t.optional(SchemaRecord),
    annotations: t.optional(t.object({
        readOnlyHint: t.optional(t.boolean()),
        destructiveHint: t.optional(t.boolean()),
        idempotentHint: t.optional(t.boolean()),
        openWorldHint: t.optional(t.boolean()),
    })),
    exposed: t.boolean(),
});

export const McpServerManifestSchema = t.object({
    server: t.string(),
    path: t.string(),
    version: t.optional(t.string()),
    description: t.optional(t.string()),
    tools: t.array(McpToolManifestSchema),
    prompts: t.optional(t.array(t.any())),
    resources: t.optional(t.array(t.any())),
});

export const BridgeArtifactManifestSchema = t.object({
    name: t.string(),
    kind: t.string(),
    origin: t.union([t.literal("scan"), t.literal("bridge")]),
    package: t.optional(t.string()),
    file: t.optional(t.string()),
});

export const BridgeUnresolvedManifestSchema = t.object({
    entry: t.string(),
    reason: t.string(),
    code: t.optional(t.string()),
    package: t.optional(t.string()),
    file: t.optional(t.string()),
});

export const BridgeManifestSchema = t.object({
    file: t.union([t.string(), t.null()]),
    loaded: t.boolean(),
    packages: t.array(t.string()),
    artifacts: t.array(BridgeArtifactManifestSchema),
    unresolved: t.array(BridgeUnresolvedManifestSchema),
});

export const ProjectManifestSchema = t.object({
    schemaVersion: t.string(),
    generatedAt: t.string(),
    framework: t.object({
        name: t.string(),
        version: t.string(),
    }),
    runtime: t.string(),
    project: t.object({
        rootDir: t.string(),
        entry: t.string(),
        configFile: t.optional(t.string()),
    }),
    routes: t.array(RouteManifestSchema),
    injection: t.record(t.string(), t.array(t.string())),
    artifacts: t.array(t.string()),
    config: t.record(t.string(), t.string()),
    env: t.array(t.string()),
    mcp: t.array(McpServerManifestSchema),
    bridge: t.optional(BridgeManifestSchema),
}, {additionalProperties: true});

export interface McpToolAnnotationsManifest {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
}

export interface McpToolManifest {
    name: string;
    description?: string;
    file?: string;
    line?: number;
    inputSchema?: Record<string, any>;
    outputSchema?: Record<string, any>;
    annotations?: McpToolAnnotationsManifest;
    exposed: boolean;
}

export interface McpServerManifest {
    server: string;
    path: string;
    version?: string;
    description?: string;
    tools: McpToolManifest[];
    prompts?: Array<Record<string, any>>;
    resources?: Array<Record<string, any>>;
}

export interface ManifestRouteExample {
    name: string;
    body?: any;
    params?: Record<string, any>;
    query?: Record<string, any>;
    headers?: Record<string, any>;
    expectedStatus?: number;
}

export interface ManifestRouteError {
    code: string;
    status: number;
    description?: string;
}

export interface ProjectRouteManifest {
    method: string;
    path: string;
    version?: string;
    controller: string;
    handler: string;
    file: string;
    line: number;
    origin?: "scan" | "bridge";
    package?: string;
    input?: string;
    output?: string;
    inputSchema?: Record<string, any>;
    outputSchema?: Record<string, any>;
    querySchema?: Record<string, any>;
    paramsSchema?: Record<string, any>;
    headersSchema?: Record<string, any>;
    examples?: ManifestRouteExample[];
    errors?: ManifestRouteError[];
}

export interface ProjectManifest {
    schemaVersion: string;
    generatedAt: string;
    framework: {name: string; version: string};
    runtime: string;
    project: {rootDir: string; entry: string; configFile?: string};
    routes: ProjectRouteManifest[];
    injection: Record<string, string[]>;
    artifacts: string[];
    config: Record<string, string>;
    env: string[];
    mcp: McpServerManifest[];
    bridge?: {
        file: string | null;
        loaded: boolean;
        packages: string[];
        artifacts: Array<{
            name: string;
            kind: string;
            origin: "scan" | "bridge";
            package?: string;
            file?: string;
        }>;
        unresolved: Array<{
            entry: string;
            reason: string;
            code?: string;
            package?: string;
            file?: string;
        }>;
    };
}

export interface ManifestValidationResult {
    valid: boolean;
    errors: Array<{path: string; message: string}>;
}

/**
 * Validate a manifest against the published, versioned schema.
 */
export function validateManifest(manifest: unknown): ManifestValidationResult {
    if (!Value.Check(ProjectManifestSchema, manifest)) {
        return {
            valid: false,
            errors: [...Value.Errors(ProjectManifestSchema, manifest)].map(error => ({
                path: error.path,
                message: error.message,
            })),
        };
    }
    const version = (manifest as any)?.schemaVersion;
    if (!SUPPORTED_MANIFEST_SCHEMA_VERSIONS.has(version)) {
        return {
            valid: false,
            errors: [{
                path: "/schemaVersion",
                message: `Unsupported manifest schema version: ${version}. Supported: ${[...SUPPORTED_MANIFEST_SCHEMA_VERSIONS].join(", ")}.`,
            }],
        };
    }
    return {valid: true, errors: []};
}

export function manifestJsonSchema(): Record<string, any> {
    return JSON.parse(JSON.stringify(ProjectManifestSchema));
}
