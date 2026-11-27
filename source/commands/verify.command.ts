import path from "node:path";
import fs from "node:fs";
import {RaitonCommand} from "../core/command.ts";
import {CliError, ExitCode, fail, print, silenceStdout} from "../bin/cli-output.ts";
import {loadProject} from "../bin/project-utils.ts";
import {enableCliDebug} from "../debug/cli.ts";
import {verifyManifest, verifyHuman} from "../debug/verify.ts";
import {defaultExample} from "../debug/examples.ts";
import type {ProjectManifest, ProjectRouteManifest} from "../manifest/schema.ts";
import type {DebugVerificationReport} from "../debug/types.ts";
import {asCliError, parseMethods} from "./debug.shared.ts";

interface VerifyOptions {
    from?: string;
    route?: string;
    json?: boolean;
    failOn?: string;
    url?: string;
    token?: string;
    unsafe?: boolean;
    allowUnsafe?: boolean;
    timeout?: string;
}

export default class VerifyCommand extends RaitonCommand {
    public readonly name = "verify";
    public readonly description = "Call route examples and validate status and output contracts";

    public register(): void {
        this.cli
            .command("verify")
            .description(this.description)
            .option("--from <source>", "Route source: manifest (default) or openapi", "manifest")
            .option("--route <path>", "Only verify routes containing this path")
            .option("--fail-on <codes>", "Additional status filters considered failures (e.g. 4xx,5xx)")
            .option("--url <base>", "Target an already running application")
            .option("--token <token>", "Bearer token sent to the target")
            .option("--allow-unsafe", "Verify non-idempotent methods explicitly")
            .option("--timeout <ms>", "Per-route timeout in milliseconds", "10000")
            .option("--json", "Emit one JSON document on stdout")
            .action((options: VerifyOptions) => this.action(options));
    }

    private async action(options: VerifyOptions): Promise<void> {
        const json = options.json === true;
        try {
            const output = json
                ? await silenceStdout(() => this.run(options, true))
                : await this.run(options, false);
            if (json) print(output.report, true);
            else print(output.text);
            if (output.report.summary.failed > 0) process.exitCode = ExitCode.DIAGNOSTIC_FAILED;
        } catch (error) {
            fail(asCliError(error), json);
        }
    }

    private async run(options: VerifyOptions, json: boolean): Promise<{report: DebugVerificationReport; text: string}> {
        const {application, manifest} = await loadProject(this.workdir, json);
        const runtime = enableCliDebug(application, this.workdir);

        let routes = manifest.routes;
        if ((options.from ?? "manifest").toLowerCase() === "openapi") {
            routes = loadOpenApiRoutes(this.workdir);
        }

        const selectedManifest: ProjectManifest = {...manifest, routes};
        const baseUrl = options.url?.replace(/\/+$/, "");
        const headers: Record<string, string> = {};
        if (options.token) headers.authorization = `Bearer ${options.token}`;

        const report = await verifyManifest({
            manifest: selectedManifest,
            application: baseUrl ? undefined : application,
            config: runtime.config,
            baseUrl,
            workdir: this.workdir,
            route: options.route,
            allowUnsafe: options.allowUnsafe === true || options.unsafe === true,
            failOn: parseMethods(options.failOn),
            timeoutMs: Number(options.timeout ?? 10_000),
            headers,
        });

        return {report, text: verifyHuman(report)};
    }
}

/**
 * Minimal OpenAPI baseline reader used by `raiton verify --from openapi`.
 * Schemas are taken from the request/response media types; examples are
 * regenerated from those schemas.
 */
function loadOpenApiRoutes(workdir: string): ProjectRouteManifest[] {
    const candidates = [
        path.join(workdir, "openapi.json"),
        path.join(workdir, ".raiton", "openapi.json"),
        path.join(workdir, "docs", "openapi.json"),
        path.join(workdir, "docs", "generated", "openapi.json"),
    ];
    const filename = candidates.find(candidate => fs.existsSync(candidate));
    if (!filename) {
        throw new CliError("No OpenAPI document found", {
            code: "OPENAPI_NOT_FOUND",
            hint: "Run `raiton openapi export --out openapi.json` first, or use --from manifest.",
            exitCode: ExitCode.PREREQUISITE_MISSING,
        });
    }

    let document: any;
    try {
        document = JSON.parse(fs.readFileSync(filename, "utf-8"));
    } catch (error: any) {
        throw new CliError(`Invalid OpenAPI document: ${error.message}`, {
            code: "INVALID_OPENAPI",
            location: filename,
            exitCode: ExitCode.PREREQUISITE_MISSING,
        });
    }

    const routes: ProjectRouteManifest[] = [];
    for (const [routePath, item] of Object.entries(document.paths ?? {})) {
        for (const [method, operation] of Object.entries(item as any)) {
            const op: any = operation;
            const inputSchema = dereference(op?.requestBody?.content?.["application/json"]?.schema, document);
            const outputSchema = dereference(op?.responses?.["200"]?.content?.["application/json"]?.schema, document);
            const querySchema = {
                type: "object",
                properties: Object.fromEntries(
                    (op?.parameters ?? [])
                        .filter((parameter: any) => parameter?.in === "query")
                        .map((parameter: any) => [parameter.name, dereference(parameter.schema ?? {}, document)]),
                ),
            };
            routes.push({
                method: method.toUpperCase(),
                path: routePath,
                controller: "OpenAPI",
                handler: op?.operationId ?? method,
                file: "",
                line: 0,
                ...(inputSchema ? {inputSchema} : {}),
                ...(outputSchema ? {outputSchema} : {}),
                ...(Object.keys(querySchema.properties).length ? {querySchema} : {}),
                examples: [defaultExample({
                    bodySchema: inputSchema,
                    querySchema: Object.keys(querySchema.properties).length ? querySchema : undefined,
                    expectedStatus: 200,
                })],
            });
        }
    }
    return routes;
}

function dereference(schema: any, document: any, seen = new Set<string>()): any {
    if (!schema || typeof schema !== "object") return schema;
    if (typeof schema.$ref === "string" && schema.$ref.startsWith("#/")) {
        if (seen.has(schema.$ref)) return {type: "object"};
        seen.add(schema.$ref);
        const target = schema.$ref
            .slice(2)
            .split("/")
            .reduce((value: any, key: string) => value?.[key.replace(/~1/g, "/").replace(/~0/g, "~")], document);
        return dereference(target ?? {type: "object"}, document, seen);
    }
    if (Array.isArray(schema)) return schema.map(item => dereference(item, document, seen));
    const output: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema)) {
        output[key] = dereference(value, document, seen);
    }
    return output;
}
