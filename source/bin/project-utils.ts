import path from "node:path";
import fs from "node:fs";
import {CliError, ExitCode, silenceStdout} from "./cli-output.ts";
import {introspectProject, type Introspection} from "../manifest/introspect.ts";
import type {ProjectManifest, ProjectRouteManifest} from "../manifest/schema.ts";

export async function loadProject(workdir: string, json = false): Promise<Introspection> {
    const {RaitonConfig} = await import("../core/config/config.ts");
    await RaitonConfig.sync(workdir, {force: true});
    const rootDir = RaitonConfig.get("rootDir") || "./source";
    const bootstrapper = path.resolve(workdir, rootDir, "main.ts");
    const candidates = [bootstrapper];

    if (!candidates.some(candidate => fs.existsSync(candidate))) {
        throw new CliError("Project entry point source/main.ts was not found", {
            code: "PREREQUISITE_MISSING",
            hint: "Create source/main.ts or set rootDir in raiton.config.ts.",
            location: workdir,
            exitCode: ExitCode.PREREQUISITE_MISSING,
        });
    }

    try {
        return json
            ? await silenceStdout(() => introspectProject(workdir))
            : await introspectProject(workdir);
    } catch (error: any) {
        if (error instanceof CliError) throw error;
        if (error?.code && String(error.code).startsWith("BRIDGE_")) {
            throw new CliError(error.message ?? String(error), {
                code: error.code,
                hint: error.diagnostic?.action ?? "Fix the bridge declaration, then retry.",
                docsUrl: error.diagnostic?.docsUrl,
                location: error.diagnostic?.location,
                exitCode: ExitCode.PREREQUISITE_MISSING,
            });
        }
        throw new CliError(error?.message ?? String(error), {
            code: "INTROSPECTION_FAILED",
            hint: "Fix the bootstrapper or configuration, then run `raiton doctor`.",
            location: workdir,
            exitCode: ExitCode.PREREQUISITE_MISSING,
        });
    }
}

export interface RouteRow {
    method: string;
    path: string;
    handler: string;
    source: string;
}

export function routeRows(manifest: ProjectManifest): RouteRow[] {
    return manifest.routes.map(route => ({
        method: route.method,
        path: route.path,
        handler: `${route.controller}.${route.handler}`,
        source: `${route.file}${route.line ? `:${route.line}` : ""}`,
    }));
}

export function printTable(rows: RouteRow[]): string {
    if (!rows.length) return "No route registered.";
    const widths = {
        method: Math.max(6, ...rows.map(row => row.method.length)),
        path: Math.max(4, ...rows.map(row => row.path.length)),
        handler: Math.max(7, ...rows.map(row => row.handler.length)),
    };

    const line = (row: RouteRow) =>
        `${row.method.padEnd(widths.method)}  ${row.path.padEnd(widths.path)}  ${row.handler.padEnd(widths.handler)}  ${row.source}`;

    return [
        `${"METHOD".padEnd(widths.method)}  ${"PATH".padEnd(widths.path)}  ${"HANDLER".padEnd(widths.handler)}  SOURCE`,
        `${"-".repeat(widths.method)}  ${"-".repeat(widths.path)}  ${"-".repeat(widths.handler)}  ${"-".repeat(6)}`,
        ...rows.map(line),
    ].join("\n");
}

export function findRoute(manifest: ProjectManifest, method: string, routePath: string): ProjectRouteManifest | undefined {
    const normalized = routePath.replace(/\/+$/, "") || "/";
    return manifest.routes.find(route =>
        route.method.toUpperCase() === method.toUpperCase()
        && (route.path.replace(/\/+$/, "") || "/") === normalized
    );
}
