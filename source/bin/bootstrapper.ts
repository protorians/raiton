import {Command} from 'commander';
import {RaitonCommands, RaitonConfig} from "@/core";
import {getPackageRoot} from "@/sdk";
import {CliTools} from "@/bin/cli-tools";


export default async function bootstrapper(cli: Command) {
    const appdir = getPackageRoot(import.meta.url);
    const workdir = `${CliTools.cwd || './'}`;
    const capabilities = new RaitonCommands(cli, appdir, workdir)

    await RaitonConfig.sync(workdir);
    await capabilities.harvest();
    return cli.parse(process.argv)
}