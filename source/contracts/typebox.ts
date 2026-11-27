/**
 * Schema-first contracts.
 *
 * A single TypeBox schema feeds runtime validation, TypeScript inference and
 * documentation generation. The `t` facade exposes:
 * - the lower-case builder API documented by Raiton (`t.object`, `t.string`);
 * - chainable constraints (`t.string().min(2).email()`);
 * - `t.infer<S>()` for compile-time inference.
 *
 * Chain methods are attached as non-enumerable properties so schemas stay
 * pure JSON Schema for OpenAPI, the manifest and `JSON.stringify`.
 */
import {Type, type Static, type TSchema, type TOptional} from "@sinclair/typebox";

declare module "@sinclair/typebox" {
    interface TSchema {
        /** Minimum string length, number value, array items or object properties. */
        min(value: number): this;
        /** Maximum string length, number value, array items or object properties. */
        max(value: number): this;
        email(): this;
        url(): this;
        uuid(): this;
        regex(pattern: RegExp | string): this;
        length(value: number): this;
        optional(): TOptional<this>;
        default(value: unknown): this;
        describe(value: string): this;
        example(value: unknown): this;
    }
}

export type {TSchema, Static};
export type Infer<S extends TSchema> = Static<S>;
export {Type};

function cloneSchema(schema: TSchema): TSchema {
    return {...schema};
}

function setFormat(schema: TSchema, format: string): TSchema {
    const next = cloneSchema(schema);
    (next as any).format = format;
    return next;
}

function decorate<T extends TSchema>(schema: T): T {
    if (!schema || typeof schema !== "object") return schema;

    const define = (name: string, value: Function) => {
        if (Object.prototype.hasOwnProperty.call(schema, name)) return;
        Object.defineProperty(schema, name, {
            value,
            enumerable: false,
            configurable: true,
        });
    };

    define("min", (value: number) => {
        const next = cloneSchema(schema) as any;
        if (next.type === "string") next.minLength = value;
        else if (next.type === "array") next.minItems = value;
        else if (next.type === "object") next.minProperties = value;
        else next.minimum = value;
        return decorate(next);
    });

    define("max", (value: number) => {
        const next = cloneSchema(schema) as any;
        if (next.type === "string") next.maxLength = value;
        else if (next.type === "array") next.maxItems = value;
        else if (next.type === "object") next.maxProperties = value;
        else next.maximum = value;
        return decorate(next);
    });

    define("length", (value: number) => {
        const next = cloneSchema(schema) as any;
        if (next.type === "string") {
            next.minLength = value;
            next.maxLength = value;
        } else if (next.type === "array") {
            next.minItems = value;
            next.maxItems = value;
        }
        return decorate(next);
    });

    define("email", () => decorate(setFormat(schema, "email")));
    define("url", () => decorate(setFormat(schema, "uri")));
    define("uuid", () => decorate(setFormat(schema, "uuid")));

    define("regex", (pattern: RegExp | string) => {
        const next = cloneSchema(schema) as any;
        next.pattern = typeof pattern === "string" ? pattern : pattern.source;
        return decorate(next);
    });

    define("optional", () => decorate(Type.Optional(schema) as any));

    define("default", (value: unknown) => {
        const next = cloneSchema(schema) as any;
        next.default = value;
        return decorate(next);
    });

    define("describe", (value: string) => {
        const next = cloneSchema(schema) as any;
        next.description = value;
        return decorate(next);
    });

    define("example", (value: unknown) => {
        const next = cloneSchema(schema) as any;
        next.examples = [value];
        return decorate(next);
    });

    return schema;
}

const LOWERCASE_METHODS = {
    string: "String",
    number: "Number",
    integer: "Integer",
    boolean: "Boolean",
    object: "Object",
    array: "Array",
    optional: "Optional",
    readonly: "Readonly",
    readonlyOptional: "ReadonlyOptional",
    record: "Record",
    any: "Any",
    unknown: "Unknown",
    never: "Never",
    null: "Null",
    undefined: "Undefined",
    union: "Union",
    literal: "Literal",
    enum: "Enum",
    intersect: "Intersect",
    tuple: "Tuple",
    ref: "Ref",
    partial: "Partial",
    required: "Required",
    pick: "Pick",
    omit: "Omit",
    keyof: "KeyOf",
    composite: "Composite",
    const: "Const",
    date: "Date",
    function: "Function",
    constructor: "Constructor",
    promise: "Promise",
    symbol: "Symbol",
    bigint: "BigInt",
    uint8array: "Uint8Array",
    this: "This",
    recursive: "Recursive",
    asyncIterator: "AsyncIterator",
    iterator: "Iterator",
} as const;

type LowercaseMethods = {
    [K in keyof typeof LOWERCASE_METHODS]:
        (typeof Type)[Extract<(typeof LOWERCASE_METHODS)[K], keyof typeof Type>];
};

type InferMethod = {
    infer: <S extends TSchema>(schema: S) => Static<S>;
};

const facade: any = {infer: undefined};

// TypeBox exposes builder methods on a frozen class instance. Copy the method
// functions onto a plain facade and wrap them so every produced schema carries
// the chainable Raiton API.
for (let prototype = Object.getPrototypeOf(Type); prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
        if (name === "constructor" || name in facade) continue;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
        if (typeof descriptor?.value === "function") {
            facade[name] = (...args: any[]) => decorate((Type as any)[name](...args));
        }
    }
}

for (const [lowercase, pascal] of Object.entries(LOWERCASE_METHODS)) {
    facade[lowercase] = (...args: any[]) => decorate((Type as any)[pascal](...args));
}
facade.infer = undefined;

export const t = facade as typeof Type & LowercaseMethods & InferMethod;
