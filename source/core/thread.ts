import type {
    BuilderInterface,
    RuntimeAdapterInterface,
    RuntimeServerInterface,
    ThreadInterface,
    ThreadOptions,
    ThreadSetupOptions,
    ThreadWaitCallable,
} from "@/types";
import {EventMessageEnum, RuntimeType} from "@/sdk/enums";
import {ProcessUtility} from "@protorians/core";
import {until} from "./process.util";
import {ApplicationInterface} from "@/types/application";
import {Runtime} from "@/sdk/runtime";
import {LBadge, Logger} from "@protorians/logger";
import {ControllerBuilder} from "@/core/controller";
import {bodyParserPlugin} from "@/sdk/plugins/body-parser.plugin";
import {Injection} from "@/core/injection/injection";
import {Throwable} from "@/sdk/exceptions";
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
        protected _options: ThreadOptions = {}
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

    public setup({application, runtime}: ThreadSetupOptions): this {
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

        this.runtimeServer = this.runtime.createServer(this.application.handle.bind(this.application))

        await this.runtimeServer.listen(port, hostname)
        if (this.builder.source) await ControllerBuilder.scan(this.builder.source)

        Logger.log(LBadge.info('Server Started'), `http://${displayHostname}:${port}${prefix ?? ''}`)
        return this;
    }
}