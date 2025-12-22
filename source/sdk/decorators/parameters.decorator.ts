import "reflect-metadata";
import {ParamTypeEnum} from "@/sdk/enums";
import {SYSTEM_DECORATORS_KEYS} from "@/sdk/constants";
import {Logger} from "@protorians/logger";
import {RouteParametersMetadataCallable} from "@/types/parameters";

/**
 * Creates a parameter decorator for methods, allowing metadata to be associated
 * with specific method parameters.
 *
 * @param {ParamTypeEnum} type - The type of the parameter, indicating how it should be processed.
 * @param {string} [key] - An optional key that can be used for additional identification or mapping.
 * @param {boolean} [multiple=false] - A flag indicating whether the parameter should accommodate multiple values.
 * @param callable
 * @return {Function} A decorator function to be applied to a method parameter.
 */
function createParamDecorator(
    type: ParamTypeEnum,
    key?: string,
    multiple: boolean = false,
    callable?: RouteParametersMetadataCallable
): (target: any, propertyKey: (string | symbol), parameterIndex: number) => void {
    return (target: any, propertyKey: string | symbol, parameterIndex: number) => {
        const construct = target.constructor || target;
        const exists: any[] = Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.ROUTES_PARAMETERS, construct, propertyKey) || [];

        exists.push({
            index: parameterIndex,
            type,
            key,
            multiple,
            callable
        });
        Reflect.defineMetadata(SYSTEM_DECORATORS_KEYS.ROUTES_PARAMETERS, exists, construct, propertyKey);
    };
}

/**
 * Creates a parameter decorator for methods, allowing access to a specific parameter from the request.
 *
 * @param {string} name - The name of the parameter to retrieve from the request.
 * @returns {Function} A function that acts as a decorator for the method parameter.
 */
export const Param = (name: string): Function => createParamDecorator(ParamTypeEnum.PARAM, name);

/**
 * Represents a decorator used to bind a parameter to the body of a request.
 * The decorator can optionally take a string argument to specify the property of the body object to retrieve.
 * This is typically used in web request handling frameworks to extract data sent in the request body.
 *
 * @param {string} [name] - Optional name of the specific property within the body object to bind.
 * @returns {Function} A parameter decorator function.
 */
export const Body = (name?: string): Function => createParamDecorator(ParamTypeEnum.BODY, name);

/**
 * A function that creates a decorator for extracting query parameters from an incoming request.
 *
 * @param {string} [name] - An optional parameter specifying the name of the query parameter to retrieve.
 *                          If not provided, all the query parameters will be extracted.
 *
 * @returns {Function} A decorator function to be used in a handler to extract the query parameter(s).
 */
export const Query = (name?: string): Function => createParamDecorator(ParamTypeEnum.QUERY, name);

/**
 * A decorator factory function used to extract a specific HTTP header field
 * from an incoming request by name and bind its value to a parameter in a route
 * handler or controller method.
 *
 * @param {string} name - The name of the HTTP header field to extract from the request.
 * @returns {Function} A parameter decorator function that retrieves the specified header value.
 */
export const Header = (name: string): Function => createParamDecorator(ParamTypeEnum.HEADER, name);

/**
 * UploadedFile is a custom parameter decorator used to extract an uploaded file from the request.
 *
 * @param {string} name - The name of the file parameter to be extracted from the request.
 * @returns {Function} A decorator function that associates the specified name with the uploaded file parameter.
 *
 * Use this decorator to handle file uploads in specific route handlers.
 */
export const UploadedFile = (name: string): Function => createParamDecorator(ParamTypeEnum.UPLOAD_FILE, name);

/**
 * UploadedFiles is a decorator factory function used to extract and process
 * files uploaded in the context of a request. It serves as a parameter
 * decorator in a function that requires access to uploaded files.
 *
 * @param {string} name - The name of the parameter to extract from the uploaded files.
 * @returns {Function} A decorator function for handling uploaded files.
 */
export const UploadedFiles = (name: string): Function => createParamDecorator(ParamTypeEnum.UPLOAD_FILE, name, true);

/**
 * A decorator factory function that creates a parameter decorator for extracting
 * the HTTP request object provided by the framework.
 * This decorator can be used in controller methods to access and manipulate the
 * incoming request data such as headers, query parameters, or payload.
 *
 * This utility relies on the `ParamTypeEnum.REQ` to indicate that the target is the
 * request object.
 *
 * @returns {Function} A parameter decorator function that binds the HTTP request object
 * to the decorated parameter.
 */
export const Req = (): Function => createParamDecorator(ParamTypeEnum.REQ);

/**
 * A decorator factory function that creates a parameter decorator for
 * injecting a response object into the route handler method of a controller.
 *
 * The decorator resolves the response object based on the specified parameter type,
 * which in this case is set to `ParamTypeEnum.RES`.
 *
 * @function
 * @returns {Function} A parameter decorator function.
 */
export const Res = (): Function => createParamDecorator(ParamTypeEnum.RES);

/**
 * A decorator factory used to define a parameter in a request handler
 * corresponding to the underlying application instance.
 *
 * This function utilizes the `createParamDecorator` to associate the parameter
 * with the `ParamTypeEnum.APP` type, which allows the decorated handler to
 * access the application context.
 *
 * Typically used in scenarios where accessing the main application instance
 * or its properties is required in the context of request handling.
 *
 * @returns {Function} A parameter decorator function.
 */
export const App = (): Function => createParamDecorator(ParamTypeEnum.APP);
