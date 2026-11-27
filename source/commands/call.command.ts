import {RaitonCommand} from "../core/command.ts";
import {CliError, ExitCode, fail, print, silenceStdout} from "../bin/cli-output.ts";
import {loadProject} from "../bin/project-utils.ts";
import {
    appendInvocationEntry,
    enableCliDebug,
    entryFromInvocation,
    remoteDebug,
} from "../debug/cli.ts";
import {invokeRoute, compareReplay} from "../debug/invocation.ts";
import {findRequest, replayPath} from "../debug/requests.ts";
import type {DebugInvocationRequest, DebugInvocationResult} from "../debug/types.ts";
import {
    asCliError,
    collect,
    isFailure,
    parseData,
    parseMethods,
    parsePairs,
} from "./debug.shared.ts";

interface CallOptions {
    data?: string;
    param?: string[];
    query?: string[];
    header?: string[];
    url?: string;
    token?: string;
    example?: string;
    dryRun?: boolean;
    validate?: boolean;
    failOn?: string;
    timeout?: string;
    replay?: string;
    force?: boolean;
    json?: boolean;
}

export default class CallCommand extends RaitonCommand {
    public readonly name = "call";
    public readonly description = "Invoke a route with local validation and a structured result";

    public register(): void {
        this.cli
            .command("call [method] [path]")
            .description(this.description)
            .option("--data <json>", "JSON body literal or @file")
            .option("--param <k=v>", "Path parameter (repeatable)", collect, [])
            .option("--query <k=v>", "Query parameter (repeatable)", collect, [])
            .option("--header <k=v>", "Header (repeatable)", collect, [])
            .option("--url <base>", "Target an already running application")
            .option("--token <token>", "Bearer token sent to the target")
            .option("--example <name>", "Use a declared route example")
            .option("--dry-run", "Print the resolved request without sending it")
            .option("--no-validate", "Skip local input validation (not recommended)")
            .option("--fail-on <codes>", "Comma-separated status filters that fail the command (e.g. 4xx,5xx)")
            .option("--timeout <ms>", "Request timeout in milliseconds", "10000")
            .option("--replay <requestId>", "Replay a request captured in the journal")
            .option("--force", "Allow replaying a non-idempotent method")
            .option("--json", "Emit one JSON document on stdout")
            .action((method: string | undefined, routePath: string | undefined, options: CallOptions) =>
                this.action(method, routePath, options));
    }

    private async action(method: string | undefined, routePath: string | undefined, options: CallOptions): Promise<void> {
        const json = options.json === true;
        try {
            const output = json
                ? await silenceStdout(() => this.run(method, routePath, options, true))
                : await this.run(method, routePath, options, false);

            if (json) {
                print(output.result, true);
            } else {
                print(output.text);
            }

            if (output.failed) process.exitCode = ExitCode.DIAGNOSTIC_FAILED;
        } catch (error) {
            fail(asCliError(error), json);
        }
    }

    private async run(
        method: string | undefined,
        routePath: string | undefined,
        options: CallOptions,
        json: boolean,
    ): Promise<{result: DebugInvocationResult; text: string; failed: boolean}> {
        const {application, manifest} = await loadProject(this.workdir, json);
        const runtime = enableCliDebug(application, this.workdir);
        const baseUrl = options.url?.replace(/\/+$/, "");

        let replayEntry;
        if (options.replay) {
            replayEntry = await this.resolveReplay(options.replay, baseUrl, options);
        }

        if (!method || !routePath) {
            if (replayEntry) {
                method = replayEntry.request.method;
                routePath = replayPath(replayEntry);
            } else {
                throw new CliError("Missing route: pass <method> <path> or --replay <requestId>", {
                    code: "MISSING_ROUTE",
                    hint: "For example: raiton call GET /items/:id --param id=1",
                    exitCode: ExitCode.USAGE,
                });
            }
        }

        if (replayEntry) {
            const replayMethod = String(replayEntry.request.method).toUpperCase();
            const idempotent = replayMethod === "GET" || replayMethod === "HEAD" || replayMethod === "OPTIONS";
            if (!idempotent && !options.force && !runtime.config.replay.allowUnsafeMethods) {
                throw new CliError(`Replaying a ${replayMethod} request requires --force`, {
                    code: "UNSAFE_REPLAY",
                    hint: "Replay is restricted to idempotent methods by default. Pass --force to confirm.",
                    exitCode: ExitCode.USAGE,
                });
            }
        }

        const [pathname, search] = String(routePath).split("?");
        const queryFromPath: Record<string, string> = {};
        if (search) {
            for (const [key, value] of new URLSearchParams(search)) queryFromPath[key] = value;
        }

        const headers: Record<string, string> = {
            ...(replayEntry?.request.headers ?? {}),
            ...parsePairs(options.header, "header"),
        };
        for (const [key, value] of Object.entries(headers)) {
            if (value === "***") delete headers[key];
        }
        if (options.token) headers.authorization = `Bearer ${options.token}`;

        const spec: DebugInvocationRequest = {
            method: method!,
            path: pathname!,
            params: {
                ...(replayEntry?.request.params ?? {}),
                ...parsePairs(options.param, "param"),
            },
            query: {
                ...queryFromPath,
                ...(replayEntry?.request.query ?? {}),
                ...parsePairs(options.query, "query"),
            },
            headers,
            body: options.data !== undefined
                ? parseData(options.data, this.workdir)
                : replayEntry?.request.body,
            example: options.example,
            dryRun: options.dryRun === true,
            validate: options.validate !== false,
            timeoutMs: Number(options.timeout ?? 10_000),
            baseUrl,
            ...(options.replay ? {replayedFrom: options.replay} : {}),
        };

        const context = {
            manifest,
            application: baseUrl ? undefined : application,
            config: runtime.config,
            baseUrl,
            workdir: this.workdir,
            development: true,
        };

        const result = await invokeRoute(context, spec);
        if (replayEntry) result.comparison = compareReplay(replayEntry, result);

        // Persist the exchange in the bounded CLI session journal so a later
        // `raiton explain <requestId>` works even when the call was in-process.
        try {
            if (runtime.config.journal.enabled) {
                appendInvocationEntry(entryFromInvocation(manifest, spec, result), this.workdir);
            }
        } catch {
            // The journal bridge is best effort.
        }

        const failOn = parseMethods(options.failOn);
        const failed = isFailure(result, failOn);
        const text = this.render(result);
        return {result, text, failed};
    }

    private async resolveReplay(requestId: string, baseUrl: string | undefined, options: CallOptions) {
        if (baseUrl) {
            try {
                const response = await remoteDebug({baseUrl, token: options.token}, `/__raiton/requests/${encodeURIComponent(requestId)}`);
                if (response.status === 200 && response.body?.entry) return response.body.entry;
            } catch {
                // Fall back to the local session journal below.
            }
        }
        const local = findRequest(requestId, this.workdir);
        if (!local) {
            throw new CliError(`Unknown requestId: ${requestId}`, {
                code: "REQUEST_NOT_FOUND",
                hint: "Run `raiton requests` to list captured requests; the journal is bounded and expires after 15 minutes.",
                exitCode: ExitCode.PREREQUISITE_MISSING,
            });
        }
        return local.entry;
    }

    private render(result: DebugInvocationResult): string {
        const lines: string[] = [];
        const status = result.response.status === 0 ? "not sent" : String(result.response.status);
        lines.push(`${result.request.method} ${result.request.path} → ${status} (${result.response.durationMs}ms)`);
        lines.push(`request_id: ${result.response.requestId}`);
        lines.push(`trace_id:   ${result.response.traceId}`);
        lines.push(`contract:   input=${result.contract.input} output=${result.contract.output}`);
        if (result.comparison) {
            lines.push(
                `replay:     status ${result.comparison.status} (${result.comparison.previousStatus} → ${result.comparison.currentStatus}), ` +
                `body ${result.comparison.body}`,
            );
            for (const difference of result.comparison.differences) lines.push(`  - ${difference}`);
        }
        for (const issue of result.contract.issues) {
            lines.push(
                `  - ${issue.path} (${issue.code}): ${issue.message}` +
                (issue.expected ? ` expected ${issue.expected}` : "") +
                (issue.received !== undefined ? ` received ${issue.received}` : "") +
                (issue.location ? ` at ${issue.location}` : ""),
            );
        }
        if (result.request.dryRun) {
            lines.push(`dry-run: ${result.request.method} ${result.request.url ?? result.request.path}`);
            if (result.request.body !== undefined) lines.push(`body: ${JSON.stringify(result.request.body)}`);
        } else if (result.response.body !== undefined) {
            lines.push(JSON.stringify(result.response.body, null, 2));
        }
        if (result.nextActions.length) {
            lines.push("");
            for (const action of result.nextActions) lines.push(`next: ${action}`);
        }
        return lines.join("\n");
    }
}


