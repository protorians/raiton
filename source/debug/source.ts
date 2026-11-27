import fs from "node:fs";
import path from "node:path";
import {Injection} from "../core/injection/index.ts";
import type {DebugRouteSource} from "./types.ts";

const lineCache = new Map<string, number>();

export function relativePath(workdir: string, filename: string): string {
    if (!filename) return "";
    return path.relative(workdir, filename).split(path.sep).join("/");
}

/** Relativize a `file:line` location captured by a decorator. */
export function relativeLocation(location: string | undefined, workdir = process.cwd()): string | undefined {
    if (!location) return undefined;
    const match = location.match(/^(.*):(\d+)$/);
    if (!match) return location;
    const file = match[1];
    if (!path.isAbsolute(file)) return location;
    return `${relativePath(workdir, file)}:${match[2]}`;
}

function methodLine(filename: string, propertyKey: string): number {
    if (!filename) return 0;
    const key = `${filename}:${propertyKey}`;
    const cached = lineCache.get(key);
    if (cached !== undefined) return cached;
    try {
        if (!fs.existsSync(filename)) return 0;
        const lines = fs.readFileSync(filename, "utf-8").split(/\r?\n/);
        const escaped = propertyKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`^\\s*(?:async\\s+)?${escaped}\\s*(?:<[^>]*>)?\\s*\\(`);
        const loose = new RegExp(`\\b${escaped}\\s*\\(`);
        let index = lines.findIndex(line => pattern.test(line));
        if (index < 0) index = lines.findIndex(line => loose.test(line));
        const value = index >= 0 ? index + 1 : 0;
        lineCache.set(key, value);
        return value;
    } catch {
        return 0;
    }
}

/** Clear cached line numbers after an HMR reload. */
export function invalidateSourceCache(): void {
    lineCache.clear();
}

/**
 * Resolve the source location of a compiled route. Called once per handler
 * compilation, never on the request hot path.
 */
export function resolveRouteSource(
    controllerClass: any,
    controllerMeta: any,
    routeMeta: any,
    workdir = process.cwd(),
): DebugRouteSource {
    const controller = controllerClass?.name ?? controllerMeta?.name ?? "Controller";
    const handler = String(routeMeta?.propertyKey ?? "handler");
    const absolute = Injection.getArtifactPath(controller) ?? "";
    const method = String(routeMeta?.method ?? "GET").toUpperCase();
    return {
        file: relativePath(workdir, absolute),
        line: methodLine(absolute, handler),
        controller,
        handler,
        decorator: `@${method.charAt(0)}${method.slice(1).toLowerCase()}("${routeMeta?.path ?? ""}")`,
    };
}

/**
 * Extract the first application frame from a stack trace. Used only in
 * development to point at the throwing line.
 */
export function firstUserFrame(stack?: string): string | undefined {
    if (!stack) return undefined;
    const lines = stack.split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/\(?([^()\s]+):(\d+):(\d+)\)?$/);
        if (!match) continue;
        const file = match[1];
        if (file.includes("node_modules")) continue;
        if (file.includes("/source/debug/")) continue;
        if (file.includes("/framework/errors/")) continue;
        return `${relativePath(process.cwd(), file)}:${match[2]}`;
    }
    return undefined;
}

export function stackLines(error: any, limit = 20): string[] | undefined {
    const stack = typeof error?.stack === "string" ? error.stack : undefined;
    if (!stack) return undefined;
    return stack.split(/\r?\n/).slice(0, limit);
}
