import {ConfigurableInterface} from "../../types/config.ts";
import {JsonUtil} from "../../framework/utilities/index.ts";
import {ConfigValidationError, validateConfig} from "./schema.ts";

function mergeWithPackage(config: Partial<ConfigurableInterface>, workdir: string) {
    let pkg: any = {};
    try {
        pkg = JsonUtil.import(workdir + '/package.json');
    } catch {
        pkg = {};
    }

    const merged = {
        ...config,
        ...(pkg.raitonConfig || {}),
        rootDir: config.rootDir || pkg.raitonConfig?.rootDir || './',
        version: config.version || pkg.raitonConfig?.version || pkg.version || '0.0.1',
    } as ConfigurableInterface;

    const validation = validateConfig(merged);
    if (!validation.valid) throw new ConfigValidationError(validation.errors);
    return merged;
}

/**
 * Typed project configuration helper. It validates field types and ranges at
 * definition time, before the application opens a listening port.
 */
export async function defineConfig<T extends Partial<ConfigurableInterface> = Partial<ConfigurableInterface>>(
    config?: T,
): Promise<T & ConfigurableInterface> {
    return mergeWithPackage(config ?? {}, process.cwd()) as T & ConfigurableInterface;
}

/** Synchronous variant for configuration files that cannot await. */
export function defineConfigSync<T extends Partial<ConfigurableInterface> = Partial<ConfigurableInterface>>(
    config?: T,
): T & ConfigurableInterface {
    return mergeWithPackage(config ?? {}, process.cwd()) as T & ConfigurableInterface;
}
