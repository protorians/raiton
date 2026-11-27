import fs from "node:fs";
import path from "node:path";
import {RaitonConfig} from "../core/config/config.ts";
import {RaitonThread} from "../core/thread.ts";
import {Raiton} from "../core/raiton.ts";
import {Injection} from "../core/injection/injection.ts";
import {Artifacts} from "../framework/artifacts.ts";
import {getMcpServerRegistry} from "../core/mcp/metadata.ts";
import {METADATA_KEYS} from "../framework/constants/index.ts";
import {contractToJsonSchema, isCompositeInput, type RouteContract} from "../contracts/index.ts";
import {MANIFEST_SCHEMA_VERSION, type ProjectManifest, type ProjectRouteManifest} from "./schema.ts";
import {getRouteContract} from "../contracts/decorators.ts";

import pkg from "../../package.json" with {type: "json"};

export interface GenerateManifestOptions {
    workdir?: string;
    /** Rebuild even when a cached manifest exists. */
    refresh?: boolean;
}

let cachedManifest: ProjectManifest | null = null;
let cachedWorkdir: string | null = null;

export function invalidateManifest(): void {
    cachedManifest = null;
    cachedWorkdir = null;
}

export function manifestCache(): {cached: boolean; workdir: string | null} {
    return {cached: Boolean(cachedManifest), workdir: cachedWorkdir};
}

function describeType(value: any): string {
    if (Array.isArray(value)) return "array";
    if (value === null) return "null";
    return typeof value;
}

function resolveRoot(workdir: string): string {
    return path.resolve(workdir, RaitonConfig.get("rootDir") || "./");
}

function relative(workdir: string, filename: string): string {
    return path.relative(workdir, filename).split(path.sep).join("/");
}

function schemaName(schema: any): string | undefined {
    if (!schema) return undefined;
    return schema.title || schema.$id || schema.type || "object";
}

function routeLine(filename: string, propertyKey: string): number {
    try {
        if (!filename || !fs.existsSync(filename)) return 0;
        const lines = fs.readFileSync(filename, "utf-8").split(/\r?\n/);
        const pattern = new RegExp(`\\b${propertyKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`);
        const index = lines.findIndex(line => pattern.test(line));
        return index >= 0 ? index + 1 : 0;
    } catch {
        return 0;
    }
}

function routeContracts(handler: any, controllerClass: any, propertyKey: string): RouteContract | undefined {
    return (handler as any)?._raitonContract ?? getRouteContract(controllerClass, propertyKey);
}

function buildRoutes(workdir: string): ProjectRouteManifest[] {
    const app: any = RaitonThread.current?.application;
    const router = app?.root?.router;
    if (!router) return [];

    const output: ProjectRouteManifest[] = [];

    const metricsPath = RaitonConfig.getObservability().metricsPath;

    for (const route of router.getRoutes()) {
        const meta = (route.handler as any)?._raitonMeta;
        if (!meta) {
            // Framework routes (health, manual `app.get`, MCP endpoints) carry
            // no controller metadata but are still part of the inventory.
            // Internal tooling routes are excluded from the public inventory.
            if ((route.handler as any)?._raitonInternal) continue;
            if (route.path.startsWith("/__dev") || route.path === metricsPath) continue;
            output.push({
                method: String(route.method).toUpperCase(),
                path: route.version ? `/${route.version}${route.path}` : route.path,
                version: route.version,
                controller: "Application",
                handler: route.name || "handler",
                file: "",
                line: 0,
            });
            continue;
        }
        const {routeMeta, controllerMeta, controllerClass} = meta;
        const controllerName = controllerClass?.name ?? "Controller";
        const file = Injection.getArtifactPath(controllerName) ?? "";
        const contract = routeContracts(route.handler, controllerClass, routeMeta.propertyKey);

        const inputSchema = contract?.input && !isCompositeInput(contract.input)
            ? contractToJsonSchema(contract.input)
            : contract?.input && isCompositeInput(contract.input) && contract.input.body
                ? contractToJsonSchema(contract.input.body)
                : undefined;
        const outputSchema = contract?.output ? contractToJsonSchema(contract.output) : undefined;

        output.push({
            method: String(routeMeta.method).toUpperCase(),
            path: `${controllerMeta.prefix ?? ""}${routeMeta.path}`.replace(/\/+/g, "/") || "/",
            version: route.version,
            controller: controllerName,
            handler: String(routeMeta.propertyKey),
            file: file ? relative(workdir, file) : "",
            line: routeLine(file, String(routeMeta.propertyKey)),
            input: schemaName(inputSchema),
            output: schemaName(outputSchema),
            inputSchema,
            outputSchema,
        });
    }

    output.sort((left, right) => `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`));
    return output;
}

function dependencyName(value: any): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return value;
    if (typeof value === "function") {
        const metadata = Reflect.getMetadata(METADATA_KEYS.CONTAINER, value);
        return metadata?.name ?? value.name;
    }
    return undefined;
}

function buildInjection(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};

    for (const definition of Injection.classes.values()) {
        const dependencies: string[] = [];
        const parameters = Reflect.getMetadata(METADATA_KEYS.INJECT_PARAMETERS, definition.construct) || [];
        const designParameters = Reflect.getMetadata("design:paramtypes", definition.construct) || [];
        const length = Math.max(parameters.length, designParameters.length);

        for (let index = 0; index < length; index++) {
            const name = dependencyName(parameters[index]) ?? dependencyName(designParameters[index]);
            if (name) dependencies.push(name);
        }

        const properties = Reflect.getMetadata(METADATA_KEYS.INJECT_PROPERTIES, definition.construct);
        if (properties) {
            for (const value of properties.values()) {
                const name = dependencyName(value);
                if (name) dependencies.push(name);
            }
        }

        graph[definition.name] = [...new Set(dependencies)];
    }

    return graph;
}

function buildArtifacts(workdir: string): string[] {
    const root = resolveRoot(workdir);
    if (!fs.existsSync(root)) return [];
    const found = new Set<string>();

    try {
        for (const entry of fs.readdirSync(root, {recursive: true})) {
            const filename = path.join(root, String(entry));
            const classification = Artifacts.classify(filename);
            if (classification) found.add(classification.artifactType);
        }
    } catch {
        // A missing or unreadable source tree is reported by `doctor`.
    }

    return [...found].sort();
}

const ENV_PATTERNS = [
    /process\.env\.([A-Z][A-Z0-9_]*)/g,
    /process\.env\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g,
    /\benv\(\s*["']([A-Z][A-Z0-9_]*)["']/g,
];

function buildEnv(workdir: string): string[] {
    const root = resolveRoot(workdir);
    const names = new Set<string>();

    const collect = (content: string) => {
        for (const pattern of ENV_PATTERNS) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(content))) names.add(match[1]);
        }
    };

    if (fs.existsSync(root)) {
        try {
            for (const entry of fs.readdirSync(root, {recursive: true})) {
                const file = path.join(root, String(entry));
                if (!/\.(ts|tsx|js|mjs|cjs|mts|cts)$/.test(file)) continue;
                collect(fs.readFileSync(file, "utf-8"));
            }
        } catch {
            // Ignore unreadable files.
        }
    }

    for (const envFile of [".env.example", ".env.sample"]) {
        const filename = path.join(workdir, envFile);
        if (!fs.existsSync(filename)) continue;
        for (const line of fs.readFileSync(filename, "utf-8").split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=/);
            if (match) names.add(match[1]);
        }
    }

    return [...names].sort();
}

function buildMcp(workdir: string): ProjectManifest["mcp"] {
    const registry = getMcpServerRegistry();
    const exposeDestructive = RaitonConfig.get("mcp")?.exposeDestructive ?? false;
    const output: ProjectManifest["mcp"] = [];

    for (const entry of registry.values()) {
        const serverFile = Injection.getArtifactPath(entry.construct?.name ?? entry.name)
            ?? Injection.getArtifactPath(entry.name)
            ?? "";
        const tools = entry.metadata.tools.map(tool => {
            const annotations = (tool as any).annotations ?? {};
            const destructive = annotations.destructiveHint === true;
            return {
                name: tool.name,
                description: tool.description,
                file: serverFile ? relative(workdir, serverFile) : "",
                line: routeLine(serverFile, tool.propertyKey),
                inputSchema: (tool as any).inputSchema
                    ? contractToJsonSchema((tool as any).inputSchema)
                    : argumentsToSchema(tool.arguments),
                outputSchema: (tool as any).outputSchema
                    ? contractToJsonSchema((tool as any).outputSchema)
                    : undefined,
                annotations,
                exposed: !destructive || exposeDestructive || (entry.metadata as any).exposeDestructive === true,
            };
        });

        output.push({
            server: entry.name,
            path: entry.path,
            version: entry.version,
            description: entry.description,
            tools,
            prompts: entry.metadata.prompts.map(prompt => ({name: prompt.name, description: prompt.description})),
            resources: [
                ...entry.metadata.resources.map(resource => ({uri: resource.uri, name: resource.name, mimeType: resource.mimeType})),
                ...entry.metadata.resourceTemplates.map(resource => ({uriTemplate: resource.uri, name: resource.name, mimeType: resource.mimeType})),
            ],
        });
    }

    return output;
}

function argumentsToSchema(args: any[]) {
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const arg of args) {
        const schema = arg.schema ? {...arg.schema} : {type: "string"};
        if (arg.description) schema.description = arg.description;
        properties[arg.name] = schema;
        if (arg.required) required.push(arg.name);
    }
    return {
        type: "object",
        properties,
        ...(required.length ? {required} : {}),
    };
}

function buildConfig(): Record<string, string> {
    const output: Record<string, string> = {};
    for (const [key, value] of RaitonConfig.current.entries()) {
        if (value === undefined) continue;
        output[key] = describeType(value);
    }
    return output;
}

/**
 * Generate the machine-readable project inventory. This function is never
 * called on a request hot path: it is used by CLI commands and, in
 * development, by the dev page endpoint.
 */
export function generateManifest(options: GenerateManifestOptions = {}): ProjectManifest {
    const workdir = options.workdir ?? process.cwd();

    if (!options.refresh && cachedManifest && cachedWorkdir === workdir) {
        return cachedManifest;
    }

    const runtime = (RaitonThread.current as any)?.runtime?.type ?? "unknown";
    const sourceRoot = RaitonConfig.get("rootDir") || "./";
    const entry = path.join(sourceRoot, "main.ts").split(path.sep).join("/");

    const manifest: ProjectManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        framework: {
            name: Raiton.identifier,
            version: pkg.version,
        },
        runtime: String(runtime),
        project: {
            rootDir: sourceRoot,
            entry,
            ...(RaitonConfig.source ? {configFile: relative(workdir, RaitonConfig.source)} : {}),
        },
        routes: buildRoutes(workdir),
        injection: buildInjection(),
        artifacts: buildArtifacts(workdir),
        config: buildConfig(),
        env: buildEnv(workdir),
        mcp: buildMcp(workdir),
    };

    cachedManifest = manifest;
    cachedWorkdir = workdir;
    return manifest;
}

export function writeManifest(filename: string, manifest: ProjectManifest): void {
    fs.mkdirSync(path.dirname(filename), {recursive: true});
    fs.writeFileSync(filename, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}
