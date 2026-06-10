import {ConfigurableInterface} from "../../types/config";
import {JsonUtil} from "../../framework/utilities";

export async function defineConfig(config?: ConfigurableInterface) {
    const workdir = process.cwd();
    const pkg = JsonUtil.import(workdir + '/package.json');

    config = {...config || {}, ...pkg.raitonConfig || {}} as ConfigurableInterface;
    config.rootDir = config.rootDir || './';
    config.version = config.version || pkg.version || '0.0.1';

    return config;
}