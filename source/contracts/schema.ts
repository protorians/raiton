import {FormatRegistry, Kind, Type as TypeBox, type TSchema} from "@sinclair/typebox";
import {Value} from "@sinclair/typebox/value";

// TypeBox 0.34 ships an empty format registry. Register the formats documented
// by the framework so `t.string().email()` is validated consistently.
const FORMATS: Record<string, RegExp> = {
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    hostname: /^(?=.{1,253}$)([a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/,
    ipv4: /^(\d{1,3}\.){3}\d{1,3}$/,
    ipv6: /^[0-9a-fA-F:]+$/,
    uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
    uri: /^[a-zA-Z][a-zA-Z0-9+.-]*:/,
    "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
    date: /^\d{4}-\d{2}-\d{2}$/,
    time: /^\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
};

for (const [format, pattern] of Object.entries(FORMATS)) {
    if (!FormatRegistry.Has(format)) {
        FormatRegistry.Set(format, value => pattern.test(value));
    }
}

/**
 * Minimal Standard Schema v1 surface. We only rely on the `validate` method so
 * Zod, Valibot, ArkType and friends can be plugged without a hard dependency.
 */
export interface StandardSchemaIssue {
    path?: ReadonlyArray<PropertyKey | {key: PropertyKey}>;
    message?: string;
    code?: string;
}

export interface StandardSchemaV1<T = unknown> {
    readonly "~standard": {
        readonly version: number;
        readonly vendor: string;
        readonly validate: (value: unknown) => StandardSchemaResult<T> | Promise<StandardSchemaResult<T>>;
        readonly jsonSchema?: Record<string, unknown>;
    };
}

export type StandardSchemaResult<T = unknown> =
    | {value: T; issues?: undefined}
    | {issues: ReadonlyArray<StandardSchemaIssue>; value?: undefined};

export type ContractSchema = TSchema | StandardSchemaV1<any>;

export interface ContractIssue {
    path: string;
    code: string;
    message: string;
    /** Expected value, format or constraint (development diagnostics). */
    expected?: string;
    /** Received value summary (development diagnostics, redacted upstream). */
    received?: string;
    /** Contract or decorator source location, when available. */
    location?: string;
}

export interface ContractValidationResult<T = unknown> {
    success: boolean;
    value?: T;
    issues: ContractIssue[];
}

export function isStandardSchema(value: any): value is StandardSchemaV1 {
    return !!value
        && typeof value === "object"
        && "~standard" in value
        && typeof (value as any)["~standard"]?.validate === "function";
}

export function isTypeBoxSchema(value: any): value is TSchema {
    if (!value || typeof value !== "object") return false;
    if (isStandardSchema(value)) return false;
    return Kind in value
        || typeof value.type === "string"
        || Array.isArray(value.type)
        || "anyOf" in value
        || "oneOf" in value
        || "allOf" in value
        || "$ref" in value;
}

export function isContractSchema(value: any): value is ContractSchema {
    return isTypeBoxSchema(value) || isStandardSchema(value);
}

function normalizePath(path: unknown): string {
    if (Array.isArray(path)) {
        return path
            .map(segment => typeof segment === "object" && segment !== null && "key" in segment
                ? String((segment as any).key)
                : String(segment))
            .join(".");
    }
    if (typeof path === "string") return path.replace(/^\//, "").replace(/\//g, ".");
    return "";
}

function issueCodeFromTypeBox(error: any): string {
    const schema = error?.schema ?? {};
    if (schema.format) return "invalid_format";
    if (schema.enum) return "invalid_enum";
    if (schema.type === "string") return "invalid_string";
    if (schema.type === "number" || schema.type === "integer") return "invalid_number";
    if (schema.type === "boolean") return "invalid_boolean";
    if (schema.type === "array") return "invalid_array";
    if (schema.type === "object") return "invalid_object";
    if (error?.type !== undefined) return "invalid_value";
    return "invalid_value";
}

/**
 * Human-readable description of the expected value for an issue. Kept short so
 * error bodies stay token-efficient.
 */
export function describeExpected(schema: any): string | undefined {
    if (!schema || typeof schema !== "object") return undefined;
    if (schema.const !== undefined) return JSON.stringify(schema.const);
    if (Array.isArray(schema.enum)) return schema.enum.map((value: any) => JSON.stringify(value)).join(" | ");
    if (schema.format) return `format:${schema.format}`;
    if (Array.isArray(schema.anyOf)) {
        const values = schema.anyOf.map((item: any) => describeExpected(item)).filter(Boolean);
        if (values.length) return values.join(" | ");
    }
    if (schema.type === "string") {
        const constraints: string[] = [];
        if (Number.isFinite(schema.minLength)) constraints.push(`minLength ${schema.minLength}`);
        if (Number.isFinite(schema.maxLength)) constraints.push(`maxLength ${schema.maxLength}`);
        if (typeof schema.pattern === "string") constraints.push(`pattern ${schema.pattern}`);
        return constraints.length ? `string (${constraints.join(", ")})` : "string";
    }
    if (schema.type === "number" || schema.type === "integer") {
        const constraints: string[] = [];
        if (Number.isFinite(schema.minimum)) constraints.push(`>= ${schema.minimum}`);
        if (Number.isFinite(schema.maximum)) constraints.push(`<= ${schema.maximum}`);
        if (Number.isFinite(schema.exclusiveMinimum)) constraints.push(`> ${schema.exclusiveMinimum}`);
        if (Number.isFinite(schema.exclusiveMaximum)) constraints.push(`< ${schema.exclusiveMaximum}`);
        return constraints.length ? `${schema.type} (${constraints.join(", ")})` : String(schema.type);
    }
    if (schema.type === "array") {
        const constraints: string[] = [];
        if (Number.isFinite(schema.minItems)) constraints.push(`minItems ${schema.minItems}`);
        if (Number.isFinite(schema.maxItems)) constraints.push(`maxItems ${schema.maxItems}`);
        return constraints.length ? `array (${constraints.join(", ")})` : "array";
    }
    return schema.type ? String(schema.type) : undefined;
}

/** Bounded, one-line summary of a received value. */
export function describeReceived(value: any, maxLength = 80): string {
    if (value === undefined) return "undefined";
    if (value === null) return "null";
    if (typeof value === "string") return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
    if (Array.isArray(value)) return `array(${value.length})`;
    if (typeof value === "object") {
        const name = (value as any)?.constructor?.name;
        return name && name !== "Object" ? name : "object";
    }
    return String(value);
}

function schemaOptions(schema: any): Record<string, any> {
    const options: Record<string, any> = {};
    const keys = [
        "title", "description", "format", "default", "examples",
        "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
        "minLength", "maxLength", "pattern",
        "minItems", "maxItems", "uniqueItems",
        "minProperties", "maxProperties",
    ];
    for (const key of keys) {
        if (schema[key] !== undefined) options[key] = schema[key];
    }
    return options;
}

/**
 * Convert plain JSON Schema (no TypeBox `Kind`) to TypeBox so the value checker
 * can validate it. Already-compiled TypeBox schemas are returned unchanged.
 */
export function toTypeBoxSchema(schema: any): TSchema {
    if (!schema || typeof schema !== "object") return TypeBox.Any();
    if (Kind in schema) return schema;

    if (Array.isArray(schema.anyOf)) {
        return TypeBox.Union(schema.anyOf.map((item: any) => toTypeBoxSchema(item)));
    }
    if (Array.isArray(schema.oneOf)) {
        return TypeBox.Union(schema.oneOf.map((item: any) => toTypeBoxSchema(item)));
    }
    if (Array.isArray(schema.allOf)) {
        return TypeBox.Intersect(schema.allOf.map((item: any) => toTypeBoxSchema(item)));
    }
    if (Array.isArray(schema.enum)) {
        return TypeBox.Union(schema.enum.map((value: any) => TypeBox.Literal(value)));
    }
    if (schema.const !== undefined) {
        return TypeBox.Literal(schema.const);
    }
    if (Array.isArray(schema.type)) {
        return TypeBox.Union(schema.type.map((type: string) => toTypeBoxSchema({...schema, type})));
    }

    const options = schemaOptions(schema);

    switch (schema.type) {
        case "string":
            return TypeBox.String(options);
        case "number":
            return TypeBox.Number(options);
        case "integer":
            return TypeBox.Integer(options);
        case "boolean":
            return TypeBox.Boolean(options);
        case "null":
            return TypeBox.Null(options);
        case "array":
            return TypeBox.Array(toTypeBoxSchema(schema.items), options);
        case "object": {
            const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
            const properties: Record<string, TSchema> = {};
            for (const [key, child] of Object.entries(schema.properties ?? {})) {
                const converted = toTypeBoxSchema(child);
                properties[key] = required.has(key) ? converted : TypeBox.Optional(converted);
            }
            if (schema.additionalProperties !== undefined) {
                options.additionalProperties = typeof schema.additionalProperties === "object"
                    ? toTypeBoxSchema(schema.additionalProperties)
                    : schema.additionalProperties;
            }
            return TypeBox.Object(properties, options);
        }
        default:
            return TypeBox.Any();
    }
}

/**
 * Validate a value against a TypeBox schema or any Standard Schema provider.
 * Never throws for invalid user input: callers receive a stable issue list.
 */
export async function validateContract<T = unknown>(
    schema: ContractSchema,
    value: unknown,
): Promise<ContractValidationResult<T>> {
    if (!schema) return {success: true, value: value as T, issues: []};

    if (isStandardSchema(schema)) {
        try {
            const result = await schema["~standard"].validate(value);
            if ("issues" in result && result.issues) {
                return {
                    success: false,
                    issues: result.issues.map(issue => ({
                        path: normalizePath(issue.path),
                        code: issue.code || "invalid_value",
                        message: issue.message || "Invalid value",
                    })),
                };
            }
            return {success: true, value: (result as any).value as T, issues: []};
        } catch (error: any) {
            return {
                success: false,
                issues: [{
                    path: "",
                    code: "invalid_value",
                    message: error?.message ?? "Invalid value",
                }],
            };
        }
    }

    // Plain JSON Schema (MCP tool arguments, OpenAPI baselines) has no TypeBox
    // `Kind`; compile it once into an equivalent TypeBox schema for validation.
    const typeboxSchema = toTypeBoxSchema(schema as any);
    if (Value.Check(typeboxSchema, value)) {
        return {success: true, value: value as T, issues: []};
    }

    const issues: ContractIssue[] = [];
    for (const error of Value.Errors(typeboxSchema, value)) {
        const expected = describeExpected(error.schema);
        const received = describeReceived(error.value);
        issues.push({
            path: normalizePath(error.path),
            code: issueCodeFromTypeBox(error),
            message: error.message || "Invalid value",
            ...(expected !== undefined ? {expected} : {}),
            ...(received !== undefined ? {received} : {}),
        });
    }

    if (!issues.length) {
        issues.push({path: "", code: "invalid_value", message: "Invalid value"});
    }

    return {success: false, issues};
}

const OMIT_KEYS = new Set([
    Kind,
    "~kind",
    "~guard",
    "~standard",
    "transform",
    "decode",
    "encode",
    "static",
]);

function sanitize(value: any, seen = new WeakSet<object>()): any {
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return undefined;
    seen.add(value);

    if (Array.isArray(value)) {
        return value.map(item => sanitize(item, seen)).filter(item => item !== undefined);
    }

    const output: Record<string, any> = {};
    for (const key of Object.keys(value)) {
        if (OMIT_KEYS.has(key) || key.startsWith("~")) continue;
        const sanitized = sanitize(value[key], seen);
        if (sanitized !== undefined) output[key] = sanitized;
    }
    return output;
}

/**
 * Convert any supported contract to a JSON Schema object suitable for
 * publication in the manifest or in OpenAPI documents.
 */
export function contractToJsonSchema(schema?: ContractSchema): Record<string, any> | undefined {
    if (!schema) return undefined;
    if (isStandardSchema(schema)) {
        const jsonSchema = (schema as any)["~standard"]?.jsonSchema;
        return jsonSchema ? sanitize(jsonSchema) : {type: "object"};
    }
    return sanitize(schema);
}

/**
 * OpenAPI 3.0 does not understand every JSON Schema 2020 keyword. This adapter
 * keeps the contract source unique while emitting a document most tools accept.
 */
export function contractToOpenApiSchema(schema?: ContractSchema): Record<string, any> | undefined {
    const json = contractToJsonSchema(schema);
    if (!json) return undefined;
    return openApiSanitize(json);
}

function openApiSanitize(value: any, seen = new WeakSet<object>()): any {
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return {type: "object"};
    seen.add(value);

    if (Array.isArray(value)) return value.map(item => openApiSanitize(item, seen));

    const output: Record<string, any> = {};
    for (const [key, child] of Object.entries(value)) {
        if (key === "$schema" || key === "$id") continue;
        output[key] = openApiSanitize(child, seen);
    }

    if (Array.isArray(output.type)) {
        const types = output.type.filter((type: string) => type !== "null");
        if (output.type.includes("null")) output.nullable = true;
        if (types.length === 1) output.type = types[0];
        else {
            delete output.type;
            output.oneOf = types.map((type: string) => ({type}));
        }
    }

    if ("const" in output) {
        output.enum = [output.const];
        delete output.const;
    }

    if (Array.isArray(output.anyOf)) {
        const withoutNull = output.anyOf.filter((item: any) => item?.type !== "null");
        if (withoutNull.length === 1 && output.anyOf.length === 2) {
            Object.assign(output, withoutNull[0], {nullable: true});
            delete output.anyOf;
        }
    }

    return output;
}

export interface FlattenedContractField {
    path: string;
    type?: string;
    required: boolean;
}

/**
 * Flatten an object contract to a list of field paths. Used by `contract check`.
 */
export function flattenContractFields(
    schema?: ContractSchema,
    prefix = "",
): FlattenedContractField[] {
    const json = contractToJsonSchema(schema);
    if (!json) return [];
    return flattenJsonSchema(json, prefix);
}

function flattenJsonSchema(schema: any, prefix: string): FlattenedContractField[] {
    if (!schema || typeof schema !== "object") return [];
    const output: FlattenedContractField[] = [];

    if (schema.type === "object" || schema.properties) {
        const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
        for (const [key, child] of Object.entries(schema.properties ?? {})) {
            const path = prefix ? `${prefix}.${key}` : key;
            const childSchema = child as any;
            const type = Array.isArray(childSchema.type)
                ? childSchema.type.join("|")
                : childSchema.type;
            output.push({path, type, required: required.has(key)});
            output.push(...flattenJsonSchema(childSchema, path));
        }
        return output;
    }

    if (schema.type === "array" && schema.items) {
        return flattenJsonSchema(schema.items, `${prefix}[]`);
    }

    if (prefix) output.push({path: prefix, type: schema.type, required: true});
    return output;
}
