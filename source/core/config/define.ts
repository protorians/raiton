import {Configurable} from "@/types/config";
import {JsonUtil} from "@/sdk/utilities";

export async function defineConfig(config?: Configurable) {
    const workdir = process.cwd();
    const pkg = JsonUtil.import(workdir + '/package.json');

    config = {...config || {}, ...pkg.raitonConfig || {}} as Configurable;
    config.rootDir = config.rootDir || './';
    config.version = config.version || pkg.version || '0.0.1';

    return config;
}