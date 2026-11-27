import path from "node:path";
import fs from "node:fs";
import {pathToFileURL} from "node:url";
import {ConfigurableInterface, ObservabilityConfigInterface} from "../../types/index.ts";
import {Logger} from "@protorians/logger";
import {Raiton} from "../raiton.ts";
import {ConfigFieldError, ConfigValidationError, validateConfig} from "./schema.ts";

function isConfigValidationError(error: any): error is ConfigValidationError {
    return error instanceof ConfigValidationError
        || (error?.name === "ConfigValidationError" && Array.isArray(error?.errors));
}

export interface ConfigLoadOptions {
    /** Reload even when a configuration is already cached. */
    force?: boolean;
}

export class RaitonConfig {
    static readonly current: Map<keyof ConfigurableInterface, ConfigurableInterface[keyof ConfigurableInterface]> = new Map();

    /** Field-scoped validation errors from the last load. */
    static errors: ConfigFieldError[] = [];

    /** Source file used by the last successful load. */
    static source: string | null = null;

    /**
     * Documented loading order. TypeScript first so `raiton.config.ts` is the
     * canonical file; JSON remains supported for tooling and generated projects.
     */
    protected static _extensions: string[] = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json'];

    static get<K extends keyof ConfigurableInterface>(key: K): ConfigurableInterface[K] | undefined {
        return this.current.get(key) as ConfigurableInterface[K];
    }

    static defaultConfig: ConfigurableInterface = {
        rootDir: '.',
        version: '0.0.1',
        observability: {mode: 'off'},
        validation: {responses: 'auto'},
        shutdown: {timeoutMs: 10_000},
        mcp: {exposeDestructive: false},
    }

    static reset(): void {
        this.current.clear();
        this.errors = [];
        this.source = null;
    }

    static toObject(): ConfigurableInterface {
        return Object.fromEntries(this.current.entries()) as unknown as ConfigurableInterface;
    }

    static assertValid(): void {
        if (this.errors.length) throw new ConfigValidationError(this.errors);
    }

    static getObservability(): Required<ObservabilityConfigInterface> {
        const config = this.get('observability') || {};
        const envMode = process.env.RAITON_OBSERVABILITY as ObservabilityConfigInterface['mode'] | undefined;
        const mode = envMode ?? config.mode ?? 'off';
        return {
            mode: (['off', 'metrics', 'traces', 'all'].includes(String(mode)) ? mode : 'off') as Required<ObservabilityConfigInterface>['mode'],
            metricsPath: process.env.RAITON_METRICS_PATH || config.metricsPath || '/metrics',
            otelEndpoint: process.env.RAITON_OTEL_ENDPOINT || config.otelEndpoint || '',
            requestIdHeader: process.env.RAITON_REQUEST_ID_HEADER || config.requestIdHeader || 'x-request-id',
            serviceName: config.serviceName || 'raiton',
        };
    }

    static getShutdownTimeout(): number {
        const env = process.env.RAITON_SHUTDOWN_TIMEOUT_MS;
        if (env !== undefined && Number.isFinite(Number(env))) return Number(env);
        return this.get('shutdown')?.timeoutMs ?? 10_000;
    }

    static shouldValidateResponses(isDevelopment: boolean): boolean {
        const setting = this.get('validation')?.responses ?? 'auto';
        if (setting === 'auto') return isDevelopment;
        return setting === true;
    }

    static async sync(workdir: string, options: ConfigLoadOptions = {}): Promise<Map<keyof ConfigurableInterface, ConfigurableInterface[keyof ConfigurableInterface]>> {
        if (this.current.size && !options.force) return this.current;

        this.reset();

        let loaded: Record<string, any> = {};
        let source: string | null = null;
        let thrownErrors: ConfigFieldError[] | undefined;

        for (const ext of this._extensions) {
            const configPath = path.join(workdir, `${Raiton.identifier}.config${ext}`);
            if (!fs.existsSync(configPath)) continue;

            try {
                if (ext === '.json') {
                    const content = fs.readFileSync(configPath, 'utf-8');
                    loaded = JSON.parse(content || '{}') || {};
                } else {
                    const configModule = await import(pathToFileURL(configPath).href);
                    const config = await (configModule?.default ?? configModule);
                    loaded = (config && typeof config === 'object') ? config : {};
                }
                source = configPath;
                break;
            } catch (error: any) {
                if (isConfigValidationError(error)) {
                    this.source = configPath;
                    thrownErrors = error.errors;
                    loaded = {...this.defaultConfig};
                    break;
                }

                const detail = error?.message ?? String(error);
                if (ext === '.ts' || ext === '.mts' || ext === '.cts') {
                    // On Node, native TypeScript imports may be unavailable.
                    // Try the next documented format.
                    Logger.warn(
                        `Failed to load ${path.basename(configPath)} on this runtime: ${detail}. ` +
                        `Raiton will try the next supported configuration format.`
                    );
                } else {
                    // A syntactically invalid JavaScript/JSON config must block
                    // startup rather than silently fall back to defaults.
                    Logger.error(`Failed to load ${path.basename(configPath)}: ${detail}`);
                    thrownErrors = [{
                        field: "config",
                        message: `Cannot load ${path.basename(configPath)}: ${detail}`,
                    }];
                    source = configPath;
                    loaded = {...this.defaultConfig};
                    break;
                }
            }
        }

        if (source) {
            const merged = {...this.defaultConfig, ...loaded};
            if (loaded.observability) merged.observability = {...this.defaultConfig.observability, ...loaded.observability};
            if (loaded.validation) merged.validation = {...this.defaultConfig.validation, ...loaded.validation};
            if (loaded.shutdown) merged.shutdown = {...this.defaultConfig.shutdown, ...loaded.shutdown};
            if (loaded.mcp) merged.mcp = {...this.defaultConfig.mcp, ...loaded.mcp};
            loaded = merged;
        } else {
            loaded = {...this.defaultConfig};
        }

        for (const [key, value] of Object.entries(loaded))
            this.current.set(key as keyof ConfigurableInterface, value as ConfigurableInterface[keyof ConfigurableInterface]);

        this.source = source;
        const validation = validateConfig(loaded);
        this.errors = thrownErrors ?? validation.errors;

        if (this.errors.length) {
            Logger.error(
                `Invalid ${Raiton.identifier} configuration` +
                (source ? ` in ${path.relative(workdir, source)}` : '') +
                `: ${this.errors.map(error => `${error.field} (${error.message})`).join(', ')}`
            );
        }

        return this.current;
    }
}
