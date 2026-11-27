import {t} from "../contracts/typebox.ts";
import {Value} from "@sinclair/typebox/value";

export const MANIFEST_SCHEMA_VERSION = "1.0.0";

const SchemaRecord = t.record(t.string(), t.any());

export const RouteManifestSchema = t.object({
    method: t.string(),
    path: t.string(),
    version: t.optional(t.string()),
    controller: t.string(),
    handler: t.string(),
    file: t.string(),
    line: t.number(),
    input: t.optional(t.string()),
    output: t.optional(t.string()),
    inputSchema: t.optional(SchemaRecord),
    outputSchema: t.optional(SchemaRecord),
});

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

export interface ProjectRouteManifest {
    method: string;
    path: string;
    version?: string;
    controller: string;
    handler: string;
    file: string;
    line: number;
    input?: string;
    output?: string;
    inputSchema?: Record<string, any>;
    outputSchema?: Record<string, any>;
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
    return {valid: true, errors: []};
}

export function manifestJsonSchema(): Record<string, any> {
    return JSON.parse(JSON.stringify(ProjectManifestSchema));
}
