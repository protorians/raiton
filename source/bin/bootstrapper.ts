import {Command} from 'commander';
import {RaitonCommands, RaitonConfig} from "@/core";
import {getPackageRoot} from "@/sdk";
import {CliHelpers} from "@/bin/cli-helpers";


export default async function bootstrapper(cli: Command) {
    const appdir = getPackageRoot(import.meta.url);
    const workdir = `${CliHelpers.cwd || './'}`;
    const capabilities = new RaitonCommands(cli, appdir, workdir)

    await RaitonConfig.sync(workdir);
    await capabilities.harvest();
    return cli.parse(process.argv)
}