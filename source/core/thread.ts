import type {
    BuilderInterface,
    RuntimeAdapterInterface,
    RuntimeServerInterface,
    RuntimeServerHttpsInterface,
    ThreadInterface,
    ThreadOptionsInterface,
    ThreadSetupOptionsInterface,
    ThreadWaitCallable,
} from "../types/index.ts";
import {EventMessageEnum, RuntimeType} from "../framework/enums/index.ts";
import {ProcessUtility} from "@protorians/core";
import {until} from "./process.util.ts";
import {ApplicationInterface} from "../types/application.ts";
import {Runtime} from "../framework/runtime/index.ts";
import {LBadge, Logger} from "@protorians/logger";
import {ControllerBuilder} from "./controller/index.ts";
import {registerDefaultHealthCheck} from "../framework/health-check.ts";
import {SchedulerManager} from "./scheduler/index.ts";
import {bodyParserPlugin} from "../framework/plugins/body-parser.plugin.ts";
import {Injection} from "./injection/injection.ts";
import {Throwable} from "../framework/exceptions/index.ts";
import {isBunUsed, isDenoUsed, isNodeUsed} from "../bin/constants.ts";
import {getLanIp} from "../framework/utilities/ip.util.ts";
import {RaitonConfig} from "./config/config.ts";
import {ConfigValidationError, validateConfig} from "./config/schema.ts";
import {Readiness} from "../framework/observability/readiness.ts";
import {shutdown} from "../framework/observability/shutdown.ts";
import {ArtifactRegistry} from "./bridge/registry.ts";
import {BridgeLoader} from "./bridge/loader.ts";


export class RaitonThread implements ThreadInterface {

    protected static instance: RaitonThread | null = null;

    public static get current(): RaitonThread | null {
        // if (!RaitonThread.instance) throw new Throwable('Thread not initialized')
        return RaitonThread.instance;
    }

    public static reset(): void {
        RaitonThread.instance = null;
    }

    public application: ApplicationInterface | null = null;
    public runtime: RuntimeAdapterInterface | null = null;
    public runtimeServer: RuntimeServerInterface | null = null;

    readonly appDir: string;

    constructor(
        public readonly builder: BuilderInterface,
        protected _options: ThreadOptionsInterface = {}
    ) {
        this.appDir = isDenoUsed ? (globalThis as any).Deno.cwd() : process.cwd();
        RaitonThread.instance = this;
    }

    public restart(): void {
        if (isDenoUsed) {
            (globalThis as any).Deno.emit?.(EventMessageEnum.RESTART)
            return
        }
        try {
            if (typeof process.send === 'function' && process.connected) {
                process.send(EventMessageEnum.RESTART)
            }
        } catch (e: any) {
            Logger.debug('Restart IPC unavailable', e?.message ?? e)
        }
    }

    public async stop(): Promise<void> {
        // Readiness fails immediately, before any new request is accepted.
        Readiness.markNotReady('shutting down')
        const timeout = RaitonConfig.getShutdownTimeout()
        const result = await shutdown.drain(timeout)
        Logger.info(
            `Shutdown: drained ${result.drained ? 'all' : 'partially'} ` +
            `(${result.remaining} request(s) remaining, timeout ${timeout}ms)`
        )

        try {
            await this.runtimeServer?.close()
        } catch (error: any) {
            Logger.debug('Server close failed', error?.message ?? error)
        }

        await SchedulerManager.current.stop();
        await Injection.shutdown();
        if (isDenoUsed) {
            (globalThis as any).Deno.exit(0)
            return
        }
        process.exit(0)
    }

    public async sleep(milliseconds: number): Promise<unknown> {
        return await ProcessUtility.sleep(milliseconds);
    }

    public async wait(condition: ThreadWaitCallable): Promise<void> {
        return await until(condition)
    }

    protected getNetworkIp(): string | null {
        return getLanIp() ?? null;
    }

    public setup({application, runtime}: ThreadSetupOptionsInterface): this {
        const defaultRuntime = isBunUsed
            ? RuntimeType.Bun
            : (isDenoUsed ? RuntimeType.Deno : RuntimeType.Node);
        this.runtime = new Runtime(runtime || defaultRuntime);
        this.application = application;
        // Idempotent: `Application.initialize()` already installs it, but
        // custom ApplicationInterface implementations rely on this setup hook.
        this.application.use(bodyParserPlugin())
        return this;
    }

    async run(): Promise<this> {
        if (!this.application)
            throw new Throwable('Application not defined');

        if (!this.runtime)
            throw new Throwable('Runtime not defined');

        // Configuration is validated before any socket is opened.
        if (RaitonConfig.errors.length) throw new ConfigValidationError(RaitonConfig.errors)
        const applicationValidation = validateConfig(this.application.config as any)
        if (!applicationValidation.valid) throw new ConfigValidationError(applicationValidation.errors)

        // Load only the adapter of the selected runtime.
        await (this.runtime as any).prepare?.()

        Readiness.markReady()

        const scanRoot = isNodeUsed
            ? (this.builder.out || this.builder.source)
            : this.builder.source;

        // Artifact identity is per application instance: reset it before the
        // bridge and the scan register what they mount.
        ArtifactRegistry.clear();

        // Import the bridge before the suffix scan so external services are
        // available to local controllers, then mount bridge artifacts after the
        // local scan so external controllers can inject local services.
        await BridgeLoader.load({
            workdir: this.builder.workdir,
            development: (this.application as any).development,
        });

        if (scanRoot) {
            await ControllerBuilder.scan(scanRoot)
        }

        if (BridgeLoader.state.loaded) {
            await BridgeLoader.mount(this.application)
        }

        if (scanRoot) {
            registerDefaultHealthCheck(this.application)
        }

        if (this._options.serve) {
            await SchedulerManager.current.start();

            if (isDenoUsed) {
                const addSignalListener = (globalThis as any).Deno.addSignalListener;
                if (typeof addSignalListener === 'function') {
                    addSignalListener('SIGINT', async () => { await this.stop(); });
                    addSignalListener('SIGTERM', async () => { await this.stop(); });
                }
            } else {
                process.on('SIGINT', async () => {
                    await this.stop();
                });

                process.on('SIGTERM', async () => {
                    await this.stop();
                });
            }

            const port = this.application.config.port || 5712;
            const hostname = this.application.config.hostname || '0.0.0.0';
            const displayHostname = (hostname === '0.0.0.0') ? (this.getNetworkIp() || 'localhost') : hostname;
            const prefix = this.application.config.prefix
            const httpsConfig = this.application.https

            const httpsServerOptions: RuntimeServerHttpsInterface | undefined = httpsConfig?.enabled
                ? {
                    enabled: true,
                    environment: httpsConfig.environment,
                    certificate: httpsConfig.certificate!,
                }
                : undefined

            this.runtimeServer = this.runtime.createServer(
                this.application.handle.bind(this.application),
                {prefix, https: httpsServerOptions}
            )

            const protocol = httpsConfig?.enabled ? 'https' : 'http'

            await this.runtimeServer.listen(port, hostname)

            Logger.log(LBadge.info('Local access:'), `${protocol}://localhost:${port}${prefix ?? ''}`,)
            Logger.log(LBadge.info('LAN access:'), `${protocol}://${displayHostname}:${port}${prefix ?? ''}`,)

            if (httpsConfig?.enabled) {
                Logger.log(LBadge.info('HTTPS:'), `enabled (${httpsConfig.environment ?? 'custom'})`,)
            }
        }

        return this;
    }
}