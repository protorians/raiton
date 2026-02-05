import {TSchema, Static, TProperties, Type} from "@sinclair/typebox";
import {ISchemeConfig, ISchemeOptions, IScheme} from "@/types";


export * from "@sinclair/typebox"

export function scheme() {
    return new Scheme({});
}


/**
 * A utility type for casting and inferring a type based on the provided `Schematic` generic structure.
 * It checks if the given type `T` extends from the `Schematic` type and applies the inference logic
 * defined by the `Schematic.infer` function. If the condition is not met, the type resolves to `never`.
 *
 * @template T - The generic type to evaluate and potentially infer from the `Schematic` structure.
 *
 * If `T` is an instance of `Schematic` with defined type parameters, this utility resolves to the
 * result returned by the `Schematic.infer` method applied to `T`. Otherwise, it will resolve to `never`.
 */
export type SchematicCast<T> = T extends Scheme<any, any, any, any>
    ? ReturnType<typeof Scheme.infer<T>>
    : never;

/**
 * Represents a schema configuration that can be used with type-safe operations
 * and is compatible with route options.
 *
 * @template TBody - Optional schema type for the request body.
 * @template TParams - Optional schema type for the route parameters.
 * @template TQuery - Optional schema type for the query string parameters.
 * @template TResponse - Optional schema type for the response, where each status code can have its own schema.
 */
export class Scheme<
    TBody extends TSchema | undefined = undefined,
    TParams extends TSchema | undefined = undefined,
    TQuery extends TSchema | undefined = undefined,
    TResponse extends Record<number, TSchema> | undefined = undefined
> implements IScheme<TBody, TParams, TQuery, TResponse> {
    protected _$body?: TBody;
    protected _$params?: TParams;
    protected _$querystring?: TQuery;
    protected _$response?: TResponse;

    constructor(config: ISchemeConfig<TBody, TParams, TQuery, TResponse>) {
        this._$body = config.body;
        // this._$body = config.body;
        this._$params = config.params;
        this._$querystring = config.querystring;
        this._$response = config.response;
    }

    /**
     * Retrieves the current value of the $body property.
     *
     * @return {TBody | undefined} The value of the $body property, or undefined if it is not set.
     */
    get $body(): TBody | undefined {
        return this._$body;
    }

    /**
     * Adds or updates a key-value pair in the body object.
     *
     * @param {string} key - The key to set or update in the body object.
     * @param {TProperties} value - The value to associate with the specified key.
     * @return {this} The current instance with the updated body object.
     */
    body(key: string, value: TProperties): this {
        this._$body = {...(this._$body || {}), [key]: value} as TBody;
        return this;
    }

    /**
     * Retrieves the current value of the `$params` property.
     *
     * @return {TParams | undefined} The value of `$params` if set, otherwise undefined.
     */
    get $params(): TParams | undefined {
        return this._$params;
    }

    /**
     * Adds or updates a parameter with the specified key and value.
     *
     * @param {string} key - The key associated with the parameter to set or update.
     * @param {TProperties} value - The value to associate with the specified key.
     * @return {this} The current instance with the updated parameters.
     */
    params(key: string, value: TProperties): this {
        this._$params = {...(this._$params || {}), [key]: value} as TParams;
        return this;
    }

    /**
     * Retrieves the current query string.
     *
     * @return {TQuery | undefined} The query string object if available, otherwise undefined.
     */
    get $querystring(): TQuery | undefined {
        return this._$querystring;
    }

    /**
     * Updates the query string parameters by setting the specified key-value pair.
     *
     * @param {string} key - The key of the query string parameter to set or update.
     * @param {TProperties} value - The value associated with the specified key.
     * @return {this} The current instance of the class for method chaining.
     */
    querystring(key: string, value: TProperties): this {
        this._$querystring = {...(this._$querystring || {}), [key]: value} as TQuery;
        return this;
    }

    /**
     * Retrieves the current response object.
     *
     * @return {TResponse | undefined} The response object if available; otherwise, undefined.
     */
    get $response(): TResponse | undefined {
        return this._$response;
    }

    /**
     * Adds or updates a response key-value pair in the internal response object.
     *
     * @param {number} key - The key to be added or updated in the response object.
     * @param {TProperties} value - The value associated with the given key.
     * @return {this} The current instance to allow method chaining.
     */
    response(key: number, value: TProperties): this {
        this._$response = {...(this._$response || {}), [key]: value} as TResponse;
        return this;
    }

    /**
     * Generates a schema object for validating different parts of an HTTP request.
     *
     * @return {Object} An object containing the schema definitions for `body`, `params`, `querystring`, and `response`. Each property returns a corresponding schema object.
     */
    schema(): ISchemeOptions<TBody, TParams, TQuery, TResponse> {
        const schema: ISchemeOptions<TBody, TParams, TQuery, TResponse> = {}

        if (this._$body) schema.body = Type.Object(this._$body);
        if (this._$params) schema.params = Type.Object(this._$params);
        if (this._$querystring) schema.querystring = Type.Object(this._$querystring);
        if (this._$response) schema.response = Type.Object(this._$response);

        return schema;
    }

    /**
     * Infers and extracts static types from a given schema object.
     *
     * @param {T extends Schematic<any, any, any, any>} schema - The schema to infer types from. This should extend the Schematic type.
     * @return {Object} An object containing inferred types including:
     * - Body: The static type of the request body if defined in the schema, otherwise undefined.
     * - Params: The static type of the request parameters if defined in the schema, otherwise undefined.
     * - Query: The static type of the query string if defined in the schema, otherwise undefined.
     * - Reply: The response type mappings if defined in the schema, otherwise undefined.
     */
    static infer<T extends Scheme<any, any, any, any>>(schema: T) {
        return {
            Body: schema._$body ? ({} as Static<NonNullable<T["$body"]>>) : undefined,
            Params: schema._$params
                ? ({} as Static<NonNullable<T["$params"]>>)
                : undefined,
            Query: schema._$querystring
                ? ({} as Static<NonNullable<T["$querystring"]>>)
                : undefined,
            Reply: schema._$response
                ? schema._$response as ({ [K in keyof NonNullable<T["$response"]>]: Static<NonNullable<T["$response"]>[K]> })
                : undefined,
        };
    }
}
