import {ConstructorType, SocketMetaInterface} from "../../types";
import {METADATA_KEYS} from "../../framework";
import "reflect-metadata";

export interface SocketRegistryEntryInterface {
    namespace: string;
    construct: ConstructorType;
    metadata: SocketMetaInterface;
}

const registry = new Map<string, SocketRegistryEntryInterface>();

export function getSocketMetadata(target: any): SocketMetaInterface {
    let metadata = Reflect.getMetadata(METADATA_KEYS.SOCKETS, target);
    if (!metadata) {
        metadata = { namespace: '/', events: [] };
        Reflect.defineMetadata(METADATA_KEYS.SOCKETS, metadata, target);
    }

    return metadata;
}

export function registerSocket(construct: any): SocketRegistryEntryInterface {
    const metadata = getSocketMetadata(construct.prototype || construct);
    const namespace = metadata.namespace || '/';
    const entry: SocketRegistryEntryInterface = {namespace, construct, metadata};
    registry.set(namespace, entry);
    return entry;
}

export function unregisterSocket(constructOrNamespace: string | any): boolean {
    if (typeof constructOrNamespace === 'string') {
        return registry.delete(constructOrNamespace);
    }
    const metadata = getSocketMetadata(constructOrNamespace.prototype || constructOrNamespace);
    const namespace = metadata.namespace || '/';
    return registry.delete(namespace);
}

export function getSocketRegistry(): Map<string, SocketRegistryEntryInterface> {
    return registry;
}

export function getSocketForNamespace(namespace: string): SocketRegistryEntryInterface | undefined {
    return registry.get(normalizePath(namespace));
}

export function findSocketForPath(pathname: string, prefix?: string): SocketRegistryEntryInterface | undefined {
    const normalized = normalizePath(pathname);

    if (registry.has(normalized)) return registry.get(normalized);

    if (prefix && prefix !== '/') {
        const withoutPrefix = normalized.startsWith(prefix)
            ? (normalized.substring(prefix.length) || '/')
            : null;
        if (withoutPrefix && registry.has(withoutPrefix)) return registry.get(withoutPrefix);

        const withPrefix = `${prefix}${normalized}`;
        if (registry.has(withPrefix)) return registry.get(withPrefix);
    }

    return undefined;
}

export function clearSocketRegistry(): void {
    registry.clear();
}

function normalizePath(pathname: string): string {
    if (pathname.length > 1 && pathname.endsWith('/')) {
        return pathname.slice(0, -1);
    }
    return pathname;
}
