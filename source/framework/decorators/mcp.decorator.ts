import "reflect-metadata";
import {registerMcpServer, unregisterMcpServer, getMcpServerMetadata} from "../../core/mcp";
import {Injectable} from ".";
import {LifetimeEnum} from "@protorians/core";
import {METADATA_KEYS} from "../constants";
import type {
    McpArgumentMetaInterface,
    McpArgumentSchema,
    McpElementMetaInterface,
    McpElementType,
    McpServerOptionsInterface,
} from "../../types";

/**
 * Decorate a class as an MCP server. The class methods decorated with
 * {@link McpTool}, {@link McpPrompt}, {@link McpResource} and
 * {@link McpResourceTemplate} become the server's exposed elements.
 *
 * @example
 * ```ts
 * @McpServer({ name: 'math', version: '1.0.0', path: '/mcp' })
 * class MathServer {
 *   @McpTool({ name: 'add', description: 'Add two numbers' })
 *   add(@McpArg('a', 'First operand', Number) a: number, @McpArg('b') b: number) {
 *     return a + b
 *   }
 * }
 * ```
 */
export function McpServer(options: McpServerOptionsInterface = {}) {
    return (target: any) => {
        Injectable(LifetimeEnum.TRANSIENT, options.name || target.name)(target)

        const meta = getMcpServerMetadata(target.prototype || target)
        meta.name = options.name || target.name
        meta.version = options.version || '1.0.0'
        meta.description = options.description
        meta.path = options.path || '/mcp'
        meta.instructions = options.instructions

        unregisterMcpServer(options.name || target.name)
        registerMcpServer(target)
    }
}

function createElementDecorator(type: McpElementType) {
    return (nameOrOptions?: string | {name?: string; description?: string; uri?: string; mimeType?: string; title?: string}) =>
        (target: any, propertyKey: string) => {
            const meta = getMcpServerMetadata(target)
            const name = typeof nameOrOptions === 'string'
                ? nameOrOptions
                : nameOrOptions?.name || propertyKey

            const element: McpElementMetaInterface = {
                type,
                name,
                description: typeof nameOrOptions === 'string' ? undefined : nameOrOptions?.description,
                propertyKey,
                arguments: [],
                uri: typeof nameOrOptions === 'object' ? nameOrOptions?.uri : undefined,
                mimeType: typeof nameOrOptions === 'object' ? nameOrOptions?.mimeType : undefined,
                title: typeof nameOrOptions === 'object' ? nameOrOptions?.title : undefined,
            }

            const list = meta[elementChildren(type)]
            if (list) list.push(element)

            // Capture argument metadata supplied via parameter decorators
            const arguments_ = Reflect.getMetadata(METADATA_KEYS.MCP_ARGUMENTS, target, propertyKey) || []
            element.arguments = arguments_
        }
}

function elementChildren(type: McpElementType) {
    return (type === 'tool' ? 'tools' : type === 'prompt' ? 'prompts' : type === 'resource' ? 'resources' : 'resourceTemplates')
}

/**
 * Expose a class method as an MCP tool.
 */
export function McpTool(options: {name?: string; description?: string} = {}) {
    return createElementDecorator('tool')(options)
}

/**
 * Expose a class method as an MCP prompt template.
 */
export function McpPrompt(options: {name?: string; description?: string} = {}) {
    return createElementDecorator('prompt')(options)
}

/**
 * Expose a class method as an MCP resource.
 */
export function McpResource(options: {uri: string; name?: string; description?: string; mimeType?: string}) {
    return createElementDecorator('resource')({...options, name: options.name || options.uri})
}

/**
 * Expose a class method as an MCP resource template.
 */
export function McpResourceTemplate(options: {uriTemplate: string; name?: string; description?: string; mimeType?: string}) {
    return createElementDecorator('resource-template')({
        name: options.name || options.uriTemplate,
        description: options.description,
        uri: options.uriTemplate,
        mimeType: options.mimeType,
    })
}

/**
 * Shortcut to mark a method as a resource reader (deprecated form, kept for compatibility).
 */
export function McpRead(uri?: string) {
    return createElementDecorator('resource')({uri: uri || ''})
}

/**
 * Declare an argument for an MCP tool, prompt or resource handler.
 * Applied to method parameters, in declaration order.
 */
export function McpArg(
    nameOrOptions: string | McpArgumentMetaInterface,
    description?: string,
    metatype?: any,
): any {
    return (target: any, propertyKey: string, parameterIndex: number) => {
        const arguments_ = Reflect.getMetadata(METADATA_KEYS.MCP_ARGUMENTS, target, propertyKey) || []
        arguments_[parameterIndex] = normalizeArgument(nameOrOptions, description, metatype)
        Reflect.defineMetadata(METADATA_KEYS.MCP_ARGUMENTS, arguments_, target, propertyKey)
    }
}

export {McpArg as McpArgument}

function normalizeArgument(
    nameOrOptions: string | McpArgumentMetaInterface,
    description?: string,
    metatype?: any,
): McpArgumentMetaInterface {
    if (typeof nameOrOptions === 'string') {
        return {name: nameOrOptions, description, schema: schemaFromMetatype(metatype), metatype}
    }
    return {
        name: nameOrOptions.name,
        description: nameOrOptions.description,
        schema: nameOrOptions.schema || schemaFromMetatype(nameOrOptions.metatype),
        required: nameOrOptions.required,
        metatype: nameOrOptions.metatype || metatype,
    }
}

export function schemaFromMetatype(metatype?: any): McpArgumentSchema | undefined {
    if (!metatype || metatype === Object) return undefined
    const name = metatype.name
    switch (name) {
        case 'String':
            return {type: 'string'}
        case 'Number':
            return {type: 'number'}
        case 'Boolean':
            return {type: 'boolean'}
        case 'Object':
            return {type: 'object'}
        case 'Array':
            return {type: 'array'}
        default:
            return undefined
    }
}