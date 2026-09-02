import {McpServerMetaInterface, McpServerRegistrationInterface} from "../../types";
import {METADATA_KEYS} from "../../framework/constants";
import "reflect-metadata";

const registry = new Map<string, McpServerRegistrationInterface>();

export function getMcpServerMetadata(target: any): McpServerMetaInterface {
    let metadata = Reflect.getMetadata(METADATA_KEYS.MCP, target);
    if (!metadata) {
        metadata = {
            name: undefined,
            version: '1.0.0',
            description: undefined,
            path: '/mcp',
            instructions: undefined,
            tools: [],
            prompts: [],
            resources: [],
            resourceTemplates: [],
        };
        Reflect.defineMetadata(METADATA_KEYS.MCP, metadata, target);
    }
    return metadata;
}

export function registerMcpServer(construct: any): McpServerRegistrationInterface {
    const metadata: McpServerMetaInterface = getMcpServerMetadata(construct.prototype || construct);
    const name = metadata.name || construct.name;
    const path = normalizePath(metadata.path || '/mcp');
    const entry: McpServerRegistrationInterface = {
        path,
        name,
        version: metadata.version || '1.0.0',
        description: metadata.description,
        construct,
        metadata,
    };
    registry.set(name, entry);
    return entry;
}

export function unregisterMcpServer(constructOrName: string | any): boolean {
    if (typeof constructOrName === 'string') {
        return registry.delete(constructOrName);
    }
    const metadata: McpServerMetaInterface = getMcpServerMetadata(constructOrName.prototype || constructOrName);
    const name = metadata.name || constructOrName.name;
    return registry.delete(name);
}

export function getMcpServerRegistry(): Map<string, McpServerRegistrationInterface> {
    return registry;
}

export function getMcpServer(name: string): McpServerRegistrationInterface | undefined {
    return registry.get(name);
}

export function findMcpServerForPath(pathname: string, prefix?: string): McpServerRegistrationInterface | undefined {
    const normalized = normalizePath(pathname);
    for (const entry of registry.values()) {
        if (entry.path === normalized) return entry;
        if (prefix && prefix !== '/' && entry.path.startsWith(prefix)) {
            if (entry.path === `${prefix}${normalized}`) return entry;
        }
    }
    return undefined;
}

export function clearMcpServerRegistry(): void {
    registry.clear();
}

function normalizePath(pathname: string): string {
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
    if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
    }
    return pathname;
}