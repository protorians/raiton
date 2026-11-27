import type {PluginInterface} from "../../types/index.ts";
import type {ContextInterface} from "../../types/core.ts";
import {PluginScope} from "../../core/index.ts";
import {generateOpenApiSpec} from "../utilities/openapi.utils.ts";

/**
 * OpenAPI plugin options
 */
export interface OpenApiOptions {
    /**
     * The base route for the documentation UI (e.g., '/docs')
     * @default '/docs'
     */
    route?: string | false;

    /**
     * The HTML string page. A Redoc UI is provided by default.
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

/**
 * Dependency-free default documentation UI (Redoc via CDN). The page only
 * references the JSON endpoint served by the same plugin.
 */
function relativeEndpoint(route: string | false | undefined, endpoint: string): string {
    if (!route) return endpoint;
    const base = route.split("/").slice(0, -1).join("/") || "/";
    if (!endpoint.startsWith(base === "/" ? "/" : `${base}/`)) return endpoint;
    const relative = base === "/" ? endpoint.slice(1) : endpoint.slice(base.length + 1);
    return relative || endpoint;
}

export function defaultOpenApiUi(config: Omit<OpenApiOptions, "ui">): string {
    const title = config.title || "API";
    const endpoint = relativeEndpoint(config.route, config.endpoint || "/docs/json");
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — API documentation</title>
  <style>body{margin:0;padding:0;font-family:system-ui,sans-serif;}</style>
</head>
<body>
  <redoc spec-url="${escapeHtml(endpoint)}"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>`;
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function openApiPlugin(options: OpenApiOptions = {}): PluginInterface {
    const opts = {
        route: '/docs',
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

            if (opts.route) {
                const ui = opts.ui ?? defaultOpenApiUi;
                const handler = async ({reply, req, ...context}: ContextInterface) => {
                    const optionsWithoutUi = {...opts, ui: undefined}
                    const html = ui(optionsWithoutUi, {reply, req, ...context});
                    reply.type('text/html');
                    return html || defaultOpenApiUi(optionsWithoutUi);
                };
                (handler as any)._raitonInternal = true;
                scope.get(opts.route, handler);
            }

            if (opts.endpoint) {
                const handler = async ({reply}: ContextInterface) => {
                    const spec = await generateOpenApiSpec(scope, opts);
                    reply.type('application/json');
                    return spec
                };
                (handler as any)._raitonInternal = true;
                scope.get(opts.endpoint, handler);
            }
        }
    };
}
