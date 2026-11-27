import path from "node:path";
import fs from "node:fs";
import {spawnSync} from "node:child_process";
import {RaitonCommand} from "../core/command.ts";
import {CLI_JSON_SCHEMA_VERSION, CliError, ExitCode, fail, print} from "../bin/cli-output.ts";
import {writeFiles} from "../bin/file-utils.ts";
import {
    assertRuntime,
    assertTemplate,
    projectFiles,
    type ProjectRuntime,
    type ProjectTemplate,
} from "../generators/project.templates.ts";
import {isBunUsed, isDenoUsed} from "../bin/constants.ts";
import {kebab} from "../bin/name-utils.ts";

interface NewOptions {
    template?: string;
    runtime?: string;
    dir?: string;
    yes?: boolean;
    offline?: boolean;
    install?: boolean;
    force?: boolean;
    dryRun?: boolean;
    json?: boolean;
}

function detectRuntime(): ProjectRuntime {
    if (isBunUsed) return "bun";
    if (isDenoUsed) return "deno";
    return "node";
}

function install(target: string, runtime: ProjectRuntime, json: boolean): {ran: boolean; command: string; status: number} {
    if (runtime === "deno") return {ran: false, command: "deno (imports resolved at runtime)", status: 0};

    const command = runtime === "bun" ? "bun" : "npm";
    const result = spawnSync(command, ["install"], {
        cwd: target,
        stdio: json ? ["ignore", "ignore", "inherit"] : "inherit",
        env: process.env,
    });

    return {ran: true, command: `${command} install`, status: result.status ?? 1};
}

export default class NewCommand extends RaitonCommand {
    public readonly name = "new";
    public readonly description = "Create a new Raiton project";

    public register(): void {
        this.cli
            .command("new <name>")
            .description(this.description)
            .option("--template <template>", "Project template: api, minimal, mcp-agent", "api")
            .option("--runtime <runtime>", "Target runtime: bun, node, deno")
            .option("--dir <directory>", "Target directory (defaults to ./<name>)")
            .option("--yes", "Non-interactive mode; never prompt")
            .option("--offline", "Do not access the network; skip dependency installation")
            .option("--no-install", "Do not install dependencies")
            .option("--force", "Overwrite existing files explicitly")
            .option("--dry-run", "Print the file plan without writing anything")
            .option("--json", "Emit a machine-readable result on stdout")
            .action((name: string, options: NewOptions) => this.run(name, options).catch(error => fail(error, options.json)));
    }

    private async run(name: string, options: NewOptions): Promise<void> {
        const template: ProjectTemplate = assertTemplate(options.template ?? "api");
        const runtime: ProjectRuntime = assertRuntime(options.runtime ?? detectRuntime());
        const target = options.dir
            ? path.resolve(this.workdir, options.dir)
            : path.resolve(this.workdir, name);

        if (fs.existsSync(target) && !fs.statSync(target).isDirectory()) {
            throw new CliError(`Target exists and is not a directory: ${target}`, {
                code: "INVALID_TARGET",
                hint: "Choose another directory or remove the file.",
                location: target,
                exitCode: ExitCode.FILE_CONFLICT,
            });
        }

        const files = projectFiles({name: kebab(name), template, runtime});
        const result = writeFiles(target, files, {
            force: options.force,
            dryRun: options.dryRun,
        });

        let installation: {ran: boolean; command: string; status: number} = {
            ran: false,
            command: "",
            status: 0,
        };

        if (!options.dryRun && options.offline !== true && options.install !== false) {
            installation = install(target, runtime, Boolean(options.json));
            if (installation.ran && installation.status !== 0) {
                throw new CliError(`Dependency installation failed (${installation.command})`, {
                    code: "INSTALL_FAILED",
                    hint: "Run the install command manually, or use --offline / --no-install.",
                    location: target,
                    exitCode: ExitCode.PREREQUISITE_MISSING,
                });
            }
        }

        const payload = {
            schemaVersion: CLI_JSON_SCHEMA_VERSION,
            status: options.dryRun ? "planned" : "created",
            project: kebab(name),
            template,
            runtime,
            target,
            files: result.files,
            installed: installation.ran && installation.status === 0,
            installCommand: installation.command || undefined,
            offline: Boolean(options.offline),
        };

        if (options.json) {
            print(payload, true);
            return;
        }

        if (options.dryRun) {
            print(`Would create ${payload.files.length} file(s) in ${target}:`);
            for (const file of payload.files) print(`  - ${file}`);
            return;
        }

        print(`Created ${payload.project} (${template}, ${runtime}) in ${target}`);
        print(`Next: cd ${path.relative(process.cwd(), target) || "."} && ${runtime === "node" ? "npx raiton dev" : runtime === "deno" ? "deno task dev" : "bun raiton dev"}`);
    }
}
