import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, CliError, ExitCode, fail, print} from "../bin/cli-output.ts";
import {findRoute, loadProject} from "../bin/project-utils.ts";
import {suggestRoute} from "../framework/utilities/route-suggestion.util.ts";

interface WhyOptions {
    json?: boolean;
}

export default class WhyCommand extends RaitonCommand {
    public readonly name = "why";
    public readonly description = "Explain which source registered a route";

    public register(): void {
        this.cli
            .command("why <method> <path>")
            .description(this.description)
            .option("--json", "Emit a machine-readable explanation on stdout")
            .action((method: string, routePath: string, options: WhyOptions) =>
                this.run(method, routePath, options).catch(error => fail(error, options.json)));
    }

    private async run(method: string, routePath: string, options: WhyOptions): Promise<void> {
        const {manifest} = await loadProject(this.workdir, options.json);
        const route = findRoute(manifest, method, routePath);

        if (!route) {
            const suggestion = suggestRoute(manifest.routes, method, routePath);
            throw new CliError(`Route ${method.toUpperCase()} ${routePath} was not registered`, {
                code: "ROUTE_NOT_FOUND",
                hint: suggestion ? `Did you mean ${suggestion}?` : "Run `raiton routes` to list mounted routes.",
                exitCode: ExitCode.USAGE,
            });
        }

        const origin = {
            route: `${route.method} ${route.path}`,
            file: route.file,
            line: route.line,
            controller: route.controller,
            handler: route.handler,
            decorator: `@${route.method.charAt(0)}${route.method.slice(1).toLowerCase()}("${route.path}")`,
            artifact: route.controller === "Application" ? "application" : "controller",
            input: route.input,
            output: route.output,
        };

        if (options.json) {
            print({schemaVersion: CLI_JSON_SCHEMA_VERSION, ...origin}, true);
            return;
        }

        print(`${origin.route}`);
        print(`  file:       ${origin.file}${origin.line ? `:${origin.line}` : ""}`);
        print(`  controller: ${origin.controller}.${origin.handler}`);
        print(`  decorator:  ${origin.decorator}`);
        print(`  artifact:   ${origin.artifact}`);
        if (origin.input) print(`  input:      ${origin.input}`);
        if (origin.output) print(`  output:     ${origin.output}`);
    }
}
