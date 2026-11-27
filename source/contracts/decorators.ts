import "reflect-metadata";
import {METADATA_KEYS} from "../framework/constants/decorators.constant.ts";
import {
    type ContractSchema,
    isContractSchema,
    type ContractIssue,
    validateContract,
} from "./schema.ts";

export interface RouteInputContract {
    body?: ContractSchema;
    query?: ContractSchema;
    params?: ContractSchema;
    headers?: ContractSchema;
}

export interface RouteExampleDeclaration {
    name: string;
    body?: any;
    params?: Record<string, any>;
    query?: Record<string, any>;
    headers?: Record<string, any>;
    expectedStatus?: number;
}

export interface RouteContract {
    input?: ContractSchema | RouteInputContract;
    output?: ContractSchema;
    /** Declared examples, in declaration order. */
    examples?: RouteExampleDeclaration[];
    /** Development-only source locations of the decorators. */
    inputLocation?: string;
    outputLocation?: string;
}

const INPUT_PARTS = ["body", "query", "params", "headers"] as const;

export function isCompositeInput(input: any): input is RouteInputContract {
    if (!input || typeof input !== "object") return false;
    if (isContractSchema(input)) return false;
    return INPUT_PARTS.some(part => part in input);
}

function writeContract(target: any, propertyKey: string | symbol, patch: Partial<RouteContract>) {
    const current: RouteContract = Reflect.getOwnMetadata(
        METADATA_KEYS.CONTRACT_INPUT,
        target,
        propertyKey,
    ) ?? {};
    Reflect.defineMetadata(
        METADATA_KEYS.CONTRACT_INPUT,
        {...current, ...patch},
        target,
        propertyKey,
    );
}

/**
 * Capture the decorator call site. Only used in development diagnostics; the
 * value is never exposed by production error bodies.
 */
function captureLocation(): string | undefined {
    try {
        const stack = new Error().stack;
        if (!stack) return undefined;
        for (const line of stack.split(/\r?\n/)) {
            const match = line.match(/\(?([^()\s]+):(\d+):(\d+)\)?$/);
            if (!match) continue;
            const file = match[1];
            if (file.startsWith("node:")) continue;
            if (file.includes("bun:")) continue;
            if (file.includes("/contracts/decorators.")) continue;
            if (file.includes("/contracts/index.")) continue;
            if (file.includes("node_modules")) continue;
            if (!/\.(ts|tsx|js|mjs|cjs|mts|cts)$/.test(file)) continue;
            return `${file}:${match[2]}`;
        }
    } catch {
        // Location capture is best effort.
    }
    return undefined;
}

/**
 * Declare the input contract of a route. A single schema validates the request
 * body; an object with `body`/`query`/`params`/`headers` keys validates each
 * part independently.
 */
export function Input(input: ContractSchema | RouteInputContract) {
    return (target: any, propertyKey: string | symbol) => {
        writeContract(target, propertyKey, {
            input,
            inputLocation: captureLocation(),
        });
    };
}

/**
 * Declare the output contract of a route. Enforced in development only by
 * default; see `validation.responses` configuration.
 */
export function Output(output: ContractSchema) {
    return (target: any, propertyKey: string | symbol) => {
        writeContract(target, propertyKey, {
            output,
            outputLocation: captureLocation(),
        });
    };
}

/**
 * Declare a documented, invocable example for a route. `raiton call --example`
 * and `raiton verify` use it directly; the manifest publishes it.
 */
export function Example(example: RouteExampleDeclaration) {
    return (target: any, propertyKey: string | symbol) => {
        const current: RouteContract = Reflect.getOwnMetadata(
            METADATA_KEYS.CONTRACT_INPUT,
            target,
            propertyKey,
        ) ?? {};
        const examples = [...(current.examples ?? [])];
        const index = examples.findIndex(item => item.name === example.name);
        if (index >= 0) examples[index] = example;
        else examples.push(example);
        writeContract(target, propertyKey, {examples});
    };
}

export function getRouteContract(target: any, propertyKey?: string | symbol): RouteContract | undefined {
    if (!target) return undefined;
    const holder = target.prototype ?? target;
    const contract = propertyKey !== undefined
        ? (Reflect.getOwnMetadata(METADATA_KEYS.CONTRACT_INPUT, holder, propertyKey)
            ?? Reflect.getOwnMetadata(METADATA_KEYS.CONTRACT_INPUT, target, propertyKey))
        : Reflect.getOwnMetadata(METADATA_KEYS.CONTRACT_INPUT, holder);
    return contract as RouteContract | undefined;
}

export interface RouteInputValidationResult {
    success: boolean;
    issues: ContractIssue[];
    body?: any;
}

function headersToObject(headers: any): Record<string, string> {
    if (!headers) return {};
    if (typeof headers.entries === "function") {
        return Object.fromEntries([...headers.entries()].map(([key, value]: [string, any]) => [key, String(value)]));
    }
    return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, String(value)]));
}

/**
 * Validate every declared part of a route input without mutating the request.
 */
export async function validateRouteInput(
    contract: RouteContract | undefined,
    ctx: any,
): Promise<RouteInputValidationResult> {
    if (!contract?.input) return {success: true, issues: []};

    const issues: ContractIssue[] = [];
    let body = ctx?.req?.body;

    if (isCompositeInput(contract.input)) {
        for (const part of INPUT_PARTS) {
            const schema = contract.input[part];
            if (!schema) continue;
            const value = part === "body"
                ? ctx?.req?.body
                : part === "query"
                    ? ctx?.req?.query
                    : part === "params"
                        ? (ctx?.params ?? ctx?.req?.params)
                        : headersToObject(ctx?.req?.headers);
            const result = await validateContract(schema, value);
            if (!result.success) {
                for (const issue of result.issues) {
                    issues.push({...issue, path: issue.path ? `${part}.${issue.path}` : part});
                }
            } else if (part === "body") {
                body = result.value;
            }
        }
    } else {
        const result = await validateContract(contract.input, ctx?.req?.body);
        if (!result.success) {
            // A single schema targets the request body: field paths stay
            // relative (`email`, `items[0].name`), as documented.
            issues.push(...result.issues);
        } else {
            body = result.value;
        }
    }

    return {success: issues.length === 0, issues, body};
}

export async function validateRouteOutput(
    contract: RouteContract | undefined,
    value: any,
): Promise<{success: boolean; issues: ContractIssue[]}> {
    if (!contract?.output) return {success: true, issues: []};
    // `@ApiResponse` style wrappers are unwrapped so the contract targets the
    // actual payload rather than transport metadata.
    const candidate = value && typeof value === "object" && "data" in value && "statusCode" in value
        ? (value as any).data
        : value;
    const result = await validateContract(contract.output, candidate);
    return {success: result.success, issues: result.issues};
}

export const RouteContractMetadata = {
    contractKey: METADATA_KEYS.CONTRACT_INPUT,
};
