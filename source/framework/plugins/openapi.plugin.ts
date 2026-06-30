import type {PluginInterface} from "../../types";
import type {ContextInterface} from "../../types/core";
import {PluginScope} from "../../core";
import {Logger} from "@protorians/logger";
import {generateOpenApiSpec} from "../utilities/openapi.utils";

/**
 * OpenAPI plugin options
 */
export interface OpenApiOptions {
    /**
     * The base route for the documentation UI (e.g., '/docs')
     * @default '/docs'
     */
    route?: string;

    /**
     * The HTML string page
     */
    ui?: (config: Omit<OpenApiOptions, 'ui'>, context: ContextInterface) => string;

    /**
     * The endpoint for the raw JSON OpenAPI spec (e.g., '/docs/json')
     * If set to false, disables the JSON endpoint.
     * @default '/docs/json'
     */
    endpoint?: string | false;
    /**
     * Title of the API
     * @default 'API'
     */
    title?: string;
    /**
     * Version of the API
     * @default '1.0.0'
     */
    version?: string;
    /**
     * Description of the API
     * @default ''
     */
    description?: string;
    /**
     * Terms of service URL
     */
    termsOfService?: string;
    /**
     * Contact information
     */
    contact?: {
        name?: string;
        url?: string;
        email?: string;
    };
    /**
     * License information
     */
    license?: {
        name?: string;
        url?: string;
    };
}

export function openApiPlugin(options: OpenApiOptions = {}): PluginInterface {
    const opts = {
        endpoint: '/docs/json',
        title: 'API',
        version: '1.0.0',
        description: '',
        termsOfService: undefined,
        contact: undefined,
        license: undefined,
        ...options
    };

    return {
        name: 'openapi-plugin',
        setup: (scope: PluginScope) => {

            if (opts.route && opts.ui) {
                scope.get(opts.route, async ({reply, req, ...context}: ContextInterface) => {
                    const optionsWithoutUi = {...opts, ui: undefined}
                    const html = opts.ui?.(optionsWithoutUi, {reply, req, ...context});
                    reply.type('text/html');
                    reply.send(html || 'No Ui function defined');
                });
            }

            if (opts.endpoint) {
                scope.get(opts.endpoint, async ({reply}: ContextInterface) => {
                    const spec = await generateOpenApiSpec(scope, opts);
                    reply.type('application/json');
                    return spec
                });
            }
        }
    };
}