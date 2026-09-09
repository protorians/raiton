import {Command} from 'commander';
import {RaitonCommands, RaitonConfig} from "../core/index.ts";
import {getPackageRoot} from "../framework/index.ts";
import {CliTools} from "./cli-tools.ts";


export default async function bootstrapper(cli: Command) {
    const appdir = getPackageRoot(import.meta.url);
    const workdir = `${CliTools.cwd || './'}`;
    const capabilities = new RaitonCommands(cli, appdir, workdir)

    await RaitonConfig.sync(workdir);
    await capabilities.harvest();
    return cli.parse(CliTools.argv)
}