import type {ProjectManifest} from "./schema.ts";
import {flattenContractFields, type FlattenedContractField} from "../contracts/schema.ts";

export interface ContractChange {
    route: string;
    field: string;
    kind: "route-removed" | "field-removed" | "field-added-required" | "field-type-changed" | "response-field-removed" | "response-field-added-required";
    message: string;
}

export interface ContractCheckResult {
    breaking: ContractChange[];
    checked: number;
    compatible: boolean;
}

interface RouteContractSnapshot {
    route: string;
    input: FlattenedContractField[];
    output: FlattenedContractField[];
}

function routeKey(method: string, path: string): string {
    return `${method.toUpperCase()} ${path}`;
}

function fromManifest(manifest: ProjectManifest): Map<string, RouteContractSnapshot> {
    const output = new Map<string, RouteContractSnapshot>();
    for (const route of manifest.routes) {
        output.set(routeKey(route.method, route.path), {
            route: routeKey(route.method, route.path),
            input: route.inputSchema ? flattenContractFields(route.inputSchema as any) : [],
            output: route.outputSchema ? flattenContractFields(route.outputSchema as any) : [],
        });
    }
    return output;
}

function fromOpenApi(document: any): Map<string, RouteContractSnapshot> {
    const output = new Map<string, RouteContractSnapshot>();
    for (const [path, item] of Object.entries(document?.paths ?? {})) {
        for (const [method, operation] of Object.entries((item ?? {}) as Record<string, any>)) {
            if (!["get", "post", "put", "patch", "delete", "options", "head", "trace"].includes(method)) continue;
            const requestSchema = operation?.requestBody?.content?.["application/json"]?.schema;
            const responseSchema = operation?.responses?.["200"]?.content?.["application/json"]?.schema
                ?? operation?.responses?.["201"]?.content?.["application/json"]?.schema;
            output.set(routeKey(method, path), {
                route: routeKey(method, path),
                input: requestSchema ? flattenContractFields(requestSchema as any) : [],
                output: responseSchema ? flattenContractFields(responseSchema as any) : [],
            });
        }
    }
    return output;
}

export function snapshotFromBaseline(baseline: any): Map<string, RouteContractSnapshot> {
    if (baseline?.openapi) return fromOpenApi(baseline);
    if (Array.isArray(baseline?.routes)) return fromManifest(baseline as ProjectManifest);
    throw new Error("Unsupported baseline: expected an OpenAPI document or a Raiton manifest");
}

/**
 * Compare a current manifest to a baseline and report breaking changes with the
 * route and field responsible.
 */
export function checkContracts(manifest: ProjectManifest, baseline: any): ContractCheckResult {
    const current = fromManifest(manifest);
    const previous = snapshotFromBaseline(baseline);
    const breaking: ContractChange[] = [];

    for (const [route, before] of previous) {
        const after = current.get(route);
        if (!after) {
            breaking.push({
                route,
                field: "",
                kind: "route-removed",
                message: `Route ${route} was removed`,
            });
            continue;
        }

        compareFields(route, "input", before.input, after.input, breaking, "field");
        compareFields(route, "output", before.output, after.output, breaking, "response-field");
    }

    return {
        breaking,
        checked: current.size,
        compatible: breaking.length === 0,
    };
}

function compareFields(
    route: string,
    side: "input" | "output",
    before: FlattenedContractField[],
    after: FlattenedContractField[],
    breaking: ContractChange[],
    prefix: "field" | "response-field",
) {
    const afterMap = new Map(after.map(field => [field.path, field]));
    const beforeMap = new Map(before.map(field => [field.path, field]));

    for (const field of before) {
        const current = afterMap.get(field.path);
        if (!current) {
            breaking.push({
                route,
                field: field.path,
                kind: `${prefix}-removed` as ContractChange["kind"],
                message: `${side} field "${field.path}" was removed`,
            });
            continue;
        }
        if (current.type !== field.type) {
            breaking.push({
                route,
                field: field.path,
                kind: "field-type-changed",
                message: `${side} field "${field.path}" changed type from ${field.type ?? "unknown"} to ${current.type ?? "unknown"}`,
            });
        }
    }

    for (const field of after) {
        const existed = beforeMap.get(field.path);
        if (!existed && field.required) {
            breaking.push({
                route,
                field: field.path,
                kind: `${prefix}-added-required` as ContractChange["kind"],
                message: `required ${side} field "${field.path}" was added`,
            });
        }
    }
}
