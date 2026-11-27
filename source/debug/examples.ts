/**
 * Example generation from published JSON schemas.
 *
 * Examples are deterministic: the same contract always produces the same
 * example. They are used by the manifest, OpenAPI and `raiton verify`.
 */

export interface RouteExample {
    name: string;
    body?: any;
    params?: Record<string, any>;
    query?: Record<string, any>;
    headers?: Record<string, any>;
    expectedStatus?: number;
}

function stringFor(schema: any): string {
    switch (schema?.format) {
        case "email":
            return "user@example.com";
        case "uuid":
            return "00000000-0000-4000-8000-000000000000";
        case "date-time":
            return "2026-01-01T00:00:00.000Z";
        case "date":
            return "2026-01-01";
        case "time":
            return "00:00:00";
        case "uri":
        case "url":
            return "https://example.com";
        case "hostname":
            return "example.com";
        case "ipv4":
            return "127.0.0.1";
        case "ipv6":
            return "::1";
        default:
            break;
    }
    if (typeof schema?.pattern === "string") {
        // A pattern cannot be reversed safely; use a short neutral value and
        // let `verify` report a contract mismatch instead of inventing one.
        return "example";
    }
    const min = Number.isFinite(schema?.minLength) ? Math.max(1, schema.minLength) : 1;
    const base = "example";
    return base.padEnd(min, "x").slice(0, Number.isFinite(schema?.maxLength) ? schema.maxLength : undefined);
}

function numberFor(schema: any): number {
    const min = Number.isFinite(schema?.minimum)
        ? schema.minimum
        : Number.isFinite(schema?.exclusiveMinimum)
            ? Number(schema.exclusiveMinimum) + 1
            : schema?.type === "integer" ? 1 : 1;
    if (Number.isFinite(schema?.multipleOf) && schema.multipleOf > 0) {
        return Math.ceil(min / schema.multipleOf) * schema.multipleOf;
    }
    return min;
}

/**
 * Build the smallest valid value for a JSON schema. Optional object properties
 * are omitted so examples stay readable and token-efficient.
 */
export function exampleForSchema(schema: any, depth = 0): any {
    if (!schema || typeof schema !== "object" || depth > 8) return undefined;
    if (schema.default !== undefined) return schema.default;
    if (Array.isArray(schema.examples) && schema.examples.length) return schema.examples[0];
    if (Array.isArray(schema.enum) && schema.enum.length) return schema.enum[0];
    if (schema.const !== undefined) return schema.const;

    if (Array.isArray(schema.oneOf) && schema.oneOf.length) return exampleForSchema(schema.oneOf[0], depth + 1);
    if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
        const nonNull = schema.anyOf.find((item: any) => item?.type !== "null");
        return exampleForSchema(nonNull ?? schema.anyOf[0], depth + 1);
    }
    if (Array.isArray(schema.allOf) && schema.allOf.length) {
        const merged = schema.allOf.reduce((acc: any, item: any) => ({
            ...acc,
            ...item,
            properties: {...(acc.properties ?? {}), ...(item.properties ?? {})},
            required: [...(acc.required ?? []), ...(item.required ?? [])],
        }), {});
        return exampleForSchema(merged, depth + 1);
    }

    if (Array.isArray(schema.type)) {
        const type = schema.type.find((item: string) => item !== "null") ?? schema.type[0];
        return exampleForSchema({...schema, type}, depth + 1);
    }

    switch (schema.type) {
        case "string":
            return stringFor(schema);
        case "number":
        case "integer":
            return numberFor(schema);
        case "boolean":
            return true;
        case "null":
            return null;
        case "array": {
            const min = Number.isFinite(schema.minItems) ? Math.max(0, schema.minItems) : 0;
            const length = Math.max(1, min);
            return Array.from({length}, () => exampleForSchema(schema.items, depth + 1));
        }
        case "object":
        default: {
            if (!schema.properties) {
                if (schema.type === "object") return {};
                return "example";
            }
            const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
            const output: Record<string, any> = {};
            for (const [key, child] of Object.entries(schema.properties ?? {})) {
                if (!required.has(key) && !(child as any)?.default) continue;
                const value = exampleForSchema(child, depth + 1);
                if (value !== undefined) output[key] = value;
            }
            return output;
        }
    }
}

/** Generate the default example of a route from its published schemas. */
export function defaultExample(input: {
    bodySchema?: any;
    paramsSchema?: any;
    querySchema?: any;
    headersSchema?: any;
    expectedStatus?: number;
}): RouteExample {
    const example: RouteExample = {
        name: "default",
        expectedStatus: input.expectedStatus ?? 200,
    };
    if (input.bodySchema) example.body = exampleForSchema(input.bodySchema);
    const params = input.paramsSchema ? exampleForSchema(input.paramsSchema) : undefined;
    if (params && typeof params === "object" && Object.keys(params).length) example.params = params;
    const query = input.querySchema ? exampleForSchema(input.querySchema) : undefined;
    if (query && typeof query === "object" && Object.keys(query).length) example.query = query;
    const headers = input.headersSchema ? exampleForSchema(input.headersSchema) : undefined;
    if (headers && typeof headers === "object" && Object.keys(headers).length) example.headers = headers;
    return example;
}

/**
 * Complete a route example with values for every `:param` in the path. Values
 * are inferred from the parameter contract when available, otherwise `1` is
 * used (valid for strings and integers alike).
 */
export function fillPathParams(example: RouteExample, routePath: string, paramsSchema?: any): RouteExample {
    const names = [...String(routePath).matchAll(/:([A-Za-z0-9_]+)/g)].map(match => match[1]);
    if (!names.length) return example;
    const params: Record<string, any> = {...(example.params ?? {})};
    for (const name of names) {
        if (params[name] !== undefined) continue;
        const property = paramsSchema?.properties?.[name];
        const generated = property ? exampleForSchema(property) : undefined;
        params[name] = generated !== undefined ? generated : "1";
    }
    return {...example, params};
}

export interface RouteErrorDocumentation {
    code: string;
    status: number;
    description?: string;
}

/** Documented error codes for a route, derived from its contracts. */
export function errorsForRoute(contract?: {input?: any; output?: any}): RouteErrorDocumentation[] {
    const errors: RouteErrorDocumentation[] = [];
    if (contract?.input) {
        errors.push({code: "VALIDATION_ERROR", status: 400, description: "The request does not match the input contract."});
    }
    if (contract?.output) {
        errors.push({
            code: "OUTPUT_VALIDATION_ERROR",
            status: 500,
            description: "The response does not match the output contract.",
        });
    }
    errors.push({code: "INTERNAL_SERVER_ERROR", status: 500, description: "An unexpected error occurred."});
    return errors;
}
