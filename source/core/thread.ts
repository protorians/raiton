import type {
    BuilderInterface,
    RuntimeAdapterInterface,
    RuntimeServerInterface,
    RuntimeServerHttpsInterface,
    ThreadInterface,
    ThreadOptionsInterface,
    ThreadSetupOptionsInterface,
    ThreadWaitCallable,
} from "../types";
import {EventMessageEnum, RuntimeType} from "../framework/enums";
import {ProcessUtility} from "@protorians/core";
import {until} from "./process.util";
import {ApplicationInterface} from "../types/application";
import {Runtime} from "../framework/runtime";
import {LBadge, Logger} from "@protorians/logger";
import {ControllerBuilder} from "./controller";
import {bodyParserPlugin} from "../framework/plugins/body-parser.plugin";
import {Injection} from "./injection/injection";
import {Throwable} from "../framework/exceptions";
import os from "os";


export class RaitonThread implements ThreadInterface {

    protected static instance: RaitonThread | null = null;

    public static get current(): RaitonThread | null {
        // if (!RaitonThread.instance) throw new Throwable('Thread not initialized')
        return RaitonThread.instance;
    }

    public application: ApplicationInterface | null = null;
    public runtime: RuntimeAdapterInterface | null = null;
    public runtimeServer: RuntimeServerInterface | null = null;

    readonly appDir: string;

    constructor(
        public readonly builder: BuilderInterface,
        protected _options: ThreadOptionsInterface = {}
    ) {
        this.appDir = process.cwd();
        RaitonThread.instance = this;
    }

    public restart(): void {
        process.send?.(EventMessageEnum.RESTART)
    }

    public async stop(): Promise<void> {
        await Injection.shutdown();
        process.exit(0)
    }

    public async sleep(milliseconds: number): Promise<unknown> {
        return await ProcessUtility.sleep(milliseconds);
    }

    public async wait(condition: ThreadWaitCallable): Promise<void> {
        return await until(condition)
    }

    protected getNetworkIp(): string | null {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name] || []) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return null;
    }

    public setup({application, runtime}: ThreadSetupOptionsInterface): this {
        const defaultRuntime = typeof Bun !== 'undefined' ? RuntimeType.Bun : RuntimeType.Node;
        this.runtime = new Runtime(runtime || defaultRuntime);
        this.application = application;
        this.application.use(bodyParserPlugin())
        return this;
    }

    async run(): Promise<this> {
        if (!this.application)
            throw new Throwable('Application not defined');

        if (!this.runtime)
            throw new Throwable('Runtime not defined');

        if (this.builder.source) await ControllerBuilder.scan(this.builder.source)

        if (this._options.serve) {
            process.on('SIGINT', async () => {
                await this.stop();
            });

            process.on('SIGTERM', async () => {
                await this.stop();
            });

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