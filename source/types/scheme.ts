import {TObject, TProperties, TSchema} from "@sinclair/typebox";


export interface ISchemePropertyOptions {
    optional?: boolean;
}

/**
 * The `ISchematic` interface provides a structured contract for managing and constructing schemas
 * that define the shape of request bodies, parameters, query strings, and response structures.
 * It allows dynamic assignment of schema properties and the retrieval of constructed schema configurations.
 *
 * @template TBody The schema type defining the request body.
 * @template TParams The schema type defining the request parameters.
 * @template TQuery The schema type defining the query string.
 * @template TResponse The schema type defining the response structure, indexed by HTTP status codes.
 */
export interface IScheme<
    TBody extends TSchema | undefined = undefined,
    TParams extends TSchema | undefined = undefined,
    TQuery extends TSchema | undefined = undefined,
    TResponse extends Record<number, TSchema> | undefined = undefined
> {
    /**
     * Retrieves the value of the `$body` property.
     *
     * @return {TBody | undefined} The body content of type `TBody` or `undefined` if not set.
     */
    get $body(): TBody | undefined;

    /**
     * Updates the body of the request with a specified key-value pair.
     *
     * @param {string} key - The key to be added or updated in the body of the request.
     * @param {TProperties} value - The value associated with the specified key.
     * @return {this} The current instance to allow method chaining.
     */
    body(key: string, value: TProperties): this;

    /**
     * Retrieves the current value of `$params`.
     *
     * This method returns the parameter(s) associated with the instance.
     * It may return undefined if no parameters are set.
     *
     * @return {TParams | undefined} The current parameters or undefined if none are set.
     */
    get $params(): TParams | undefined;

    /**
     * Assigns a key-value pair to the parameters of the current instance.
     *
     * @param {string} key - The key for the parameter to be set.
     * @param {TProperties} value - The value associated with the specified key.
     * @return {this} The current instance with the updated parameter.
     */
    params(key: string, value: TProperties): this;

    /**
     * Retrieves the query string associated with the current object.
     *
     * @return {TQuery | undefined} The query string if defined, otherwise undefined.
     */
    get $querystring(): TQuery | undefined;

    /**
     * Updates or sets a query string parameter with the specified key and value.
     * If the query string already contains the key, its value will be updated.
     *
     * @param {string} key - The key of the query string parameter to be updated or added.
     * @param {TProperties} value - The value to be set for the specified query string key.
     * @return {this} The current instance to allow for method chaining.
     */
    querystring(key: string, value: TProperties): this;

    /**
     * Retrieves the response object associated with the instance.
     *
     * @return {TResponse | undefined} The response object if it exists, otherwise undefined.
     */
    get $response(): TResponse | undefined;

    /**
     * Stores a key-value pair in the response object and returns the current instance for chaining.
     *
     * @param {number} key - The unique identifier for the value to be stored.
     * @param {TProperties} value - The value to store associated with the provided key.
     * @return {this} Returns the current instance to allow method chaining.
     */
    response(key: number, value: TProperties): this;

    /**
     * Provides the schema options for handling the request and response structure.
     *
     * @return {ISchemeOptions<TBody, TParams, TQuery, TResponse>} The schema options defining the types for body, params, query, and response.
     */
    schema(): ISchemeOptions<TBody, TParams, TQuery, TResponse>;
}

/**
 * Interface representing the schema configuration for various aspects of a request-response process.
 *
 * @template TBody Represents the schema for the request body. Defaults to undefined if not specified.
 * @template TParams Represents the schema for request parameters. Defaults to undefined if not specified.
 * @template TQuery Represents the schema for query string parameters. Defaults to undefined if not specified.
 * @template TResponse Represents the schema for response objects, mapped by status codes. Defaults to undefined if not specified.
 *
 * @property {TBody} [body] Optional schema definition for the request body.
 * @property {TParams} [params] Optional schema definition for the request parameters.
 * @property {TQuery} [querystring] Optional schema definition for query string parameters.
 * @property {TResponse} [response] Optional schema definition for response objects, associated with HTTP status codes.
 */
export interface ISchemeConfig<
    TBody extends TSchema | undefined = undefined,
    TParams extends TSchema | undefined = undefined,
    TQuery extends TSchema | undefined = undefined,
    TResponse extends Record<number, TSchema> | undefined = undefined
> {
    body?: TBody;
    params?: TParams;
    querystring?: TQuery;
    response?: TResponse;
}

/**
 * Interface representing schema options for defining request and response payloads
 * in a structured and strongly-typed manner.
 *
 * @template TBody - The type of the schema for the request body, or undefined if not applicable.
 * @template TParams - The type of the schema for the request parameters, or undefined if not applicable.
 * @template TQuery - The type of the schema for the query string, or undefined if not applicable.
 * @template TResponse - A record of HTTP status codes to their respective response schemas, or undefined if not applicable.
 *
 * @property body - Represents the schema definition for the request body.
 *                   This is an optional property and only applies if TBody is specified.
 * @property params - Represents the schema definition for the request parameters.
 *                     This is an optional property and only applies if TParams is specified.
 * @property querystring - Represents the schema definition for the query string.
 *                          This is an optional property and only applies if TQuery is specified.
 * @property response - Represents the schema definition for the response body, mapped by status code.
 *                       This is an optional property and only applies if TResponse is specified.
 */
export interface ISchemeOptions<
    TBody extends TSchema | undefined = undefined,
    TParams extends TSchema | undefined = undefined,
    TQuery extends TSchema | undefined = undefined,
    TResponse extends Record<number, TSchema> | undefined = undefined
> {
    body?: TObject<NonNullable<TBody>> | undefined;
    params?: TObject<NonNullable<TParams>> | undefined;
    querystring?: TObject<NonNullable<TQuery>> | undefined;
    response?: TObject<NonNullable<TResponse>> | undefined;
}