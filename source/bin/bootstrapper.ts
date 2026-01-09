import {Command} from 'commander';
import {RaitonCommands, RaitonConfig} from "@/core";
import {fileURLToPath} from "node:url"
import path from "node:path";
import {Logger} from "@protorians/logger";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function bootstrapper(cli: Command) {
    const appdir = __dirname;
    const workdir = process.cwd();
    const capabilities = new RaitonCommands(cli, appdir, workdir)

    await RaitonConfig.sync(workdir);
    await capabilities.harvest();
    return cli.parse(process.argv)
}