import type {ProjectManifest, ProjectRouteManifest} from "./schema.ts";

export interface ClientGenerationOptions {
    /** Client class/function prefix. Defaults to `RaitonClient`. */
    name?: string;
    /** Base URL used when the caller does not provide one. */
    baseUrl?: string;
}

function pascal(value: string): string {
    return value
        .replace(/[^a-zA-Z0-9]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(part => part[0].toUpperCase() + part.slice(1))
        .join("");
}

function camel(value: string): string {
    const result = pascal(value);
    return result ? result[0].toLowerCase() + result.slice(1) : "value";
}

function uniqueTypes(): Map<string, string> {
    return new Map();
}

function typeFromSchema(schema: any, models: Map<string, string>, hint: string): string {
    if (!schema || typeof schema !== "object") return "unknown";

    if (schema.$ref && typeof schema.$ref === "string") {
        const name = schema.$ref.split("/").pop();
        return name ? pascal(name) : "unknown";
    }
    if (Array.isArray(schema.anyOf)) {
        return [...new Set(schema.anyOf.map((item: any) => typeFromSchema(item, models, hint)))].join(" | ") || "unknown";
    }
    if (Array.isArray(schema.oneOf)) {
        return [...new Set(schema.oneOf.map((item: any) => typeFromSchema(item, models, hint)))].join(" | ") || "unknown";
    }
    if (Array.isArray(schema.allOf)) {
        return schema.allOf.map((item: any) => typeFromSchema(item, models, hint)).join(" & ");
    }
    if (Array.isArray(schema.type)) {
        return schema.type.map((type: string) => typeFromSchema({...schema, type}, models, hint)).join(" | ");
    }
    if (Array.isArray(schema.enum)) {
        return schema.enum.map((value: any) => JSON.stringify(value)).join(" | ");
    }
    if (schema.const !== undefined) return JSON.stringify(schema.const);

    switch (schema.type) {
        case "string":
            return "string";
        case "number":
        case "integer":
            return "number";
        case "boolean":
            return "boolean";
        case "null":
            return "null";
        case "array":
            return `Array<${typeFromSchema(schema.items, models, hint)}>`;
        case "object":
        case undefined: {
            if (schema.properties) {
                const name = schema.title ? pascal(schema.title) : pascal(hint);
                if (!models.has(name)) {
                    models.set(name, "pending");
                    const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
                    const properties = Object.entries(schema.properties)
                        .map(([key, child]) => {
                            const optional = required.has(key) ? "" : "?";
                            return `  ${safeProperty(key)}${optional}: ${typeFromSchema(child as any, models, `${hint}${pascal(key)}`)};`;
                        })
                        .join("\n");
                    models.set(name, `export interface ${name} {\n${properties}\n}`);
                }
                return name;
            }
            if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
                return `Record<string, ${typeFromSchema(schema.additionalProperties, models, hint)}>`;
            }
            return "Record<string, unknown>";
        }
        default:
            return "unknown";
    }
}

function safeProperty(key: string): string {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function pathParams(route: ProjectRouteManifest): string[] {
    return [...route.path.matchAll(/:([A-Za-z0-9_]+)/g)].map(match => match[1]);
}

function routeFunctionName(route: ProjectRouteManifest, used: Set<string>): string {
    const base = camel(`${route.method.toLowerCase()} ${route.path}`) || "request";
    let name = base;
    let index = 2;
    while (used.has(name)) name = `${base}${index++}`;
    used.add(name);
    return name;
}

const GENERIC_SCHEMA_NAMES = new Set(["object", "array", "string", "number", "integer", "boolean", "null"]);

function bodyModel(route: ProjectRouteManifest): string | undefined {
    if (!route.inputSchema) return undefined;
    const explicit = route.input && !GENERIC_SCHEMA_NAMES.has(route.input.toLowerCase())
        ? route.input
        : `${route.controller}${pascal(route.handler)}Input`;
    return pascal(explicit);
}

function outputModel(route: ProjectRouteManifest): string | undefined {
    if (!route.outputSchema) return undefined;
    const explicit = route.output && !GENERIC_SCHEMA_NAMES.has(route.output.toLowerCase())
        ? route.output
        : `${route.controller}${pascal(route.handler)}Output`;
    return pascal(explicit);
}

/**
 * Generate a typed client from the manifest. Public signatures never use `any`:
 * unknown schemas degrade to `unknown`, never to an unsafe escape hatch.
 */
export function generateClient(manifest: ProjectManifest, options: ClientGenerationOptions = {}): string {
    const models = uniqueTypes();
    const used = new Set<string>();
    const functions: string[] = [];
    const typeDeclarations: string[] = [];

    const sorted = [...manifest.routes].sort((left, right) =>
        `${left.path}:${left.method}`.localeCompare(`${right.path}:${method(right)}`));

    for (const route of sorted) {
        const inputName = bodyModel(route);
        const outputName = outputModel(route);
        const inputType = route.inputSchema
            ? typeFromSchema(route.inputSchema, models, inputName ?? "Input")
            : "unknown";
        const outputType = route.outputSchema
            ? typeFromSchema(route.outputSchema, models, outputName ?? "Output")
            : "unknown";

        if (inputName && !models.has(inputName) && route.inputSchema?.type === "object" && !route.inputSchema.properties) {
            models.set(inputName, `export type ${inputName} = ${inputType};`);
        }
        if (outputName && !models.has(outputName) && (!route.outputSchema?.properties)) {
            models.set(outputName, `export type ${outputName} = ${outputType};`);
        }

        const name = routeFunctionName(route, used);
        const params = pathParams(route);
        const paramsType = params.length
            ? `{${params.map(param => `${safeProperty(param)}: string | number;`).join(" ")}}`
            : "undefined";

        const signature: string[] = [];
        if (params.length) signature.push(`params: ${paramsType}`);
        if (route.method !== "GET" && route.method !== "HEAD" && route.inputSchema) {
            signature.push(`body: ${inputType}`);
        }
        signature.push("options: RequestOptions = {}");

        const pathExpression = params.length
            ? "`" + route.path.replace(/:([A-Za-z0-9_]+)/g, "${encodeURIComponent(String(params.$1))}") + "`"
            : JSON.stringify(route.path);

        const query = route.method === "GET"
            ? `  const query = options.query ? \`?\${new URLSearchParams(Object.entries(options.query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString()}\` : '';\n`
            : "";

        functions.push([
            `/** ${route.method} ${route.path}${route.controller ? ` — ${route.controller}.${route.handler}` : ""} */`,
            `export async function ${name}(${signature.join(", ")}): Promise<${outputType}> {`,
            query + `  return request<${outputType}>({`,
            `    method: ${JSON.stringify(route.method)},`,
            `    path: ${pathExpression} + (${route.method === "GET" ? "query" : "''"}),`,
            route.method !== "GET" && route.method !== "HEAD" && route.inputSchema ? "    body," : "",
            `    options,`,
            `  });`,
            `}`,
        ].filter(Boolean).join("\n"));
    }

    // Models may reference each other; emit declarations lazily until stable.
    let previous = "";
    for (let pass = 0; pass < 6; pass++) {
        typeDeclarations.length = 0;
        for (const declaration of models.values()) {
            if (declaration && declaration !== "pending") typeDeclarations.push(declaration);
        }
        const joined = typeDeclarations.join("\n");
        if (joined === previous) break;
        previous = joined;
    }

    const clientName = options.name ?? "RaitonClient";

    return `/* eslint-disable */
// Generated by \`raiton client\`. Do not edit by hand.
// Source: ${manifest.framework.name} ${manifest.framework.version} — manifest ${manifest.schemaVersion}

export interface ApiErrorBody {
  error: true;
  code: string;
  message: string;
  statusCode: number;
  docsUrl?: string;
  requestId?: string;
  details?: unknown;
}

export class ${clientName}Error extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown,
    public readonly docsUrl?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = ${JSON.stringify(`${clientName}Error`)};
  }
}

export interface RequestOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

export interface ClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

let clientConfig: ClientConfig = {
  baseUrl: ${JSON.stringify(options.baseUrl ?? "")},
  fetch: typeof fetch !== "undefined" ? fetch : undefined,
};

export function configureClient(config: Partial<ClientConfig>): void {
  clientConfig = {...clientConfig, ...config};
}

async function request<T>(input: {
  method: string;
  path: string;
  body?: unknown;
  options: RequestOptions;
}): Promise<T> {
  const fetchImpl = clientConfig.fetch;
  if (!fetchImpl) throw new Error("No fetch implementation available");
  const baseUrl = (input.options.baseUrl ?? clientConfig.baseUrl).replace(/\\/$/, "");
  const headers = new Headers({Accept: "application/json", ...(clientConfig.headers ?? {}), ...(input.options.headers ?? {})});
  if (input.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetchImpl(baseUrl + input.path, {
    method: input.method,
    headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: input.options.signal,
  });

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const body = (payload ?? {}) as Partial<ApiErrorBody>;
    throw new ${clientName}Error(
      body.message ?? response.statusText,
      response.status,
      body.code ?? "HTTP_ERROR",
      body.details,
      body.docsUrl,
      body.requestId,
    );
  }

  return payload as T;
}

${typeDeclarations.join("\n\n")}

${functions.join("\n\n")}
`;
}

function method(route: ProjectRouteManifest): string {
    return route.method;
}
