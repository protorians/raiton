import {RaitonCommand} from "../core/command.ts";
import {CliError, ExitCode, fail, print, silenceStdout} from "../bin/cli-output.ts";
import {RaitonConfig} from "../core/config/config.ts";
import {resolveDebugConfig} from "../debug/config.ts";
import {remoteDebug} from "../debug/cli.ts";
import {findRequest, lastRequest} from "../debug/requests.ts";
import {explainEntry, explainHuman} from "../debug/explain.ts";
import {asCliError} from "./debug.shared.ts";

interface ExplainOptions {
    last?: boolean;
    verbose?: boolean;
    url?: string;
    token?: string;
    json?: boolean;
}

export default class ExplainCommand extends RaitonCommand {
    public readonly name = "explain";
    public readonly description = "Explain a captured request: timeline, root cause and next actions";

    public register(): void {
        this.cli
            .command("explain [requestId]")
            .description(this.description)
            .option("--last", "Explain the most recent request")
            .option("--verbose", "Include redacted request and response bodies")
            .option("--url <base>", "Target an already running application")
            .option("--token <token>", "Debug token for a protected surface")
            .option("--json", "Emit one JSON document on stdout")
            .action((requestId: string | undefined, options: ExplainOptions) =>
                this.action(requestId, options));
    }

    private async action(requestId: string | undefined, options: ExplainOptions): Promise<void> {
        const json = options.json === true;
        try {
            const output = json
                ? await silenceStdout(() => this.run(requestId, options))
                : await this.run(requestId, options);
            if (json) print(output.explanation, true);
            else print(output.text);
        } catch (error) {
            fail(asCliError(error), json);
        }
    }

    private async run(requestId: string | undefined, options: ExplainOptions) {
        if (!requestId && !options.last) {
            throw new CliError("Missing request id", {
                code: "MISSING_REQUEST_ID",
                hint: "Pass a request id or --last (run `raiton requests` to list captured requests).",
                exitCode: ExitCode.USAGE,
            });
        }

        await RaitonConfig.sync(this.workdir, {force: true});
        const debugConfig = resolveDebugConfig({development: true, workdir: this.workdir});
        const target = options.url?.replace(/\/+$/, "") ?? configuredBaseUrl();
        const remotePath = options.last || requestId === "last"
            ? "/__raiton/explain/last"
            : `/__raiton/explain/${encodeURIComponent(String(requestId))}`;

        let explanation;
        try {
            const response = await remoteDebug(
                {baseUrl: target, token: options.token, timeoutMs: options.url ? 1_500 : 300},
                `${remotePath}${options.verbose ? "?verbose=true" : ""}`,
            );
            if (response.status === 200 && response.body?.diagnosis) {
                explanation = response.body;
            } else if (response.status === 401 || response.status === 403) {
                throw new CliError("The running application rejected the debug token", {
                    code: "DEBUG_UNAUTHORIZED",
                    hint: "Pass --token or set RAITON_DEBUG_TOKEN.",
                    exitCode: ExitCode.PREREQUISITE_MISSING,
                });
            }
        } catch (error) {
            if (error instanceof CliError) throw error;
            // Fall back to the bounded CLI session journal.
        }

        if (!explanation) {
            const lookup = options.last || requestId === "last"
                ? lastRequest(this.workdir)
                : findRequest(String(requestId), this.workdir);
            if (lookup) explanation = explainEntry(lookup.entry, {verbose: options.verbose});
        }

        if (!explanation) {
            if (!debugConfig.journal.enabled) {
                throw new CliError("The request journal is disabled", {
                    code: "DEBUG_JOURNAL_DISABLED",
                    hint: "Enable `debug.journal.enabled` in raiton.config.ts or set RAITON_DEBUG_JOURNAL=1, then reproduce the request.",
                    exitCode: ExitCode.PREREQUISITE_MISSING,
                });
            }
            throw new CliError(`No captured request found${requestId ? `: ${requestId}` : ""}`, {
                code: "REQUEST_NOT_FOUND",
                hint: "Run `raiton requests` to list captured requests; entries expire after 15 minutes.",
                exitCode: ExitCode.PREREQUISITE_MISSING,
            });
        }

        return {explanation, text: explainHuman(explanation)};
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
