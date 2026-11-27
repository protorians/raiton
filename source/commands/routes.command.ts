import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, fail, print} from "../bin/cli-output.ts";
import {loadProject, printTable, routeRows} from "../bin/project-utils.ts";

interface RoutesOptions {
    json?: boolean;
    method?: string;
    path?: string;
}

export default class RoutesCommand extends RaitonCommand {
    public readonly name = "routes";
    public readonly description = "List the routes mounted by the application";

    public register(): void {
        this.cli
            .command("routes")
            .description(this.description)
            .option("--json", "Emit a machine-readable list on stdout")
            .option("--method <method>", "Filter by HTTP method")
            .option("--path <path>", "Filter by path substring")
            .action((options: RoutesOptions) => this.run(options).catch(error => fail(error, options.json)));
    }

    private async run(options: RoutesOptions): Promise<void> {
        const {manifest} = await loadProject(this.workdir, options.json);
        const routes = manifest.routes.filter(route =>
            (!options.method || route.method.toUpperCase() === options.method.toUpperCase())
            && (!options.path || route.path.includes(options.path))
        );

        if (options.json) {
            print({schemaVersion: CLI_JSON_SCHEMA_VERSION, routes}, true);
            return;
        }

        print(printTable(routeRows({...manifest, routes})));
    }
}
