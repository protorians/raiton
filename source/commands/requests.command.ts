import {RaitonCommand} from "../core/command.ts";
import {CliError, ExitCode, fail, print, silenceStdout} from "../bin/cli-output.ts";
import {RaitonConfig} from "../core/config/config.ts";
import {resolveDebugConfig} from "../debug/config.ts";
import {remoteDebug} from "../debug/cli.ts";
import {listRequests} from "../debug/requests.ts";
import type {DebugRequestsList} from "../debug/types.ts";
import {asCliError} from "./debug.shared.ts";

interface RequestsOptions {
    since?: string;
    status?: string;
    route?: string;
    limit?: string;
    url?: string;
    token?: string;
    json?: boolean;
}

export default class RequestsCommand extends RaitonCommand {
    public readonly name = "requests";
    public readonly description = "List recently captured requests";

    public register(): void {
        this.cli
            .command("requests")
            .description(this.description)
            .option("--since <period>", "Only requests newer than this period (e.g. 5m, 30s)")
            .option("--status <filter>", "Status filter (e.g. 4xx, 500)")
            .option("--route <path>", "Route substring filter")
            .option("--limit <n>", "Maximum number of entries", "20")
            .option("--url <base>", "Target an already running application")
            .option("--token <token>", "Debug token for a protected surface")
            .option("--json", "Emit one JSON document on stdout")
            .action((options: RequestsOptions) => this.action(options));
    }

    private async action(options: RequestsOptions): Promise<void> {
        const json = options.json === true;
        try {
            const output = json
                ? await silenceStdout(() => this.run(options, true))
                : await this.run(options, false);
            if (json) print(output.list, true);
            else print(output.text);
        } catch (error) {
            fail(asCliError(error), json);
        }
    }

    private async run(options: RequestsOptions, json: boolean): Promise<{list: DebugRequestsList; text: string}> {
        await RaitonConfig.sync(this.workdir, {force: true});
        const debugConfig = resolveDebugConfig({development: true, workdir: this.workdir});

        // Build the target URL from the project configuration when no running
        // application is explicitly targeted.
        const target = options.url?.replace(/\/+$/, "") ?? configuredBaseUrl();

        const query = new URLSearchParams();
        if (options.since) query.set("since", options.since);
        if (options.status) query.set("status", options.status);
        if (options.route) query.set("route", options.route);
        if (options.limit) query.set("limit", options.limit);

        let remote: any;
        try {
            const response = await remoteDebug(
                {baseUrl: target, token: options.token, timeoutMs: options.url ? 1_500 : 300},
                `/__raiton/requests?${query.toString()}`,
            );
            if (response.status === 200 && response.body && Array.isArray(response.body.requests)) {
                remote = response.body;
            } else if (response.status === 401 || response.status === 403) {
                throw new CliError("The running application rejected the debug token", {
                    code: "DEBUG_UNAUTHORIZED",
                    hint: "Pass --token or set RAITON_DEBUG_TOKEN.",
                    exitCode: ExitCode.PREREQUISITE_MISSING,
                });
            }
        } catch (error) {
            if (error instanceof CliError) throw error;
            // No running application: fall back to the bounded CLI session.
        }

        const list: DebugRequestsList = remote ?? listRequests({
            since: options.since,
            status: options.status,
            route: options.route,
            limit: Number(options.limit ?? 20),
            workdir: this.workdir,
        });

        if (!list.enabled) {
            if (!debugConfig.journal.enabled) {
                throw new CliError("The request journal is disabled", {
                    code: "DEBUG_JOURNAL_DISABLED",
                    hint: "Enable `debug.journal.enabled` in raiton.config.ts or start the app with RAITON_DEBUG_JOURNAL=1.",
                    exitCode: ExitCode.PREREQUISITE_MISSING,
                });
            }
            return {
                list,
                text: "No request captured in the selected window.",
            };
        }

        if (!list.requests.length) {
            return {
                list,
                text: "No request captured in the selected window.",
            };
        }

        const lines: string[] = [];
        lines.push(`Recent requests (${list.count}/${list.capacity})`);
        for (const entry of list.requests) {
            lines.push(
                `${entry.startedAt}  ${entry.method.padEnd(6)} ${entry.route.padEnd(28)} ` +
                `${String(entry.status).padEnd(4)} ${entry.durationMs}ms  ${entry.requestId}` +
                (entry.stale ? " [stale]" : ""),
            );
        }
        lines.push("Use `raiton explain <requestId>` for the timeline and root cause.");
        return {list, text: lines.join("\n")};
    }
}

function configuredBaseUrl(): string {
    const protocol = (RaitonConfig.get("protocole") as string) || "http";
    const host = RaitonConfig.get("hostname") || "localhost";
    const port = RaitonConfig.get("port");
    const pathname = RaitonConfig.get("pathname");
    const prefix = RaitonConfig.get("prefix");
    const path = pathname && pathname !== "/" ? pathname.replace(/\/+$/, "") : "";
    const prefixed = prefix ? `/${String(prefix).replace(/^\/+|\/+$/g, "")}` : "";
    return `${protocol}://${host === "0.0.0.0" ? "localhost" : host}${port ? `:${port}` : ""}${path}${prefixed}`;
}
