import type {
    BuilderInterface,
    RuntimeAdapter,
    RuntimeServer,
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
import {Throwable} from "@/sdk/throwable";
import {ControllerBuilder} from "@/core/controller";
import {bodyParserPlugin} from "@/sdk/plugins/body-parser.plugin";


export class RaitonThread implements ThreadInterface {

    protected static instance: RaitonThread | null = null;

    public static get current(): RaitonThread {
        if (!RaitonThread.instance) throw new Throwable('Thread not initialized')
        return RaitonThread.instance;
    }

    public application: ApplicationInterface | null = null;
    public runtime: RuntimeAdapter | null = null;
    public server: RuntimeServer | null = null;

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

    public stop(): void {
        process.exit(0)
    }

    public async sleep(milliseconds: number): Promise<unknown> {
        return await ProcessUtility.sleep(milliseconds);
    }

    public async wait(condition: ThreadWaitCallable): Promise<void> {
        return await until(condition)
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

        const port = this.application.config.port || 5712;

        this.server = this.runtime.createServer(this.application.handle.bind(this.application))

        await this.server.listen(port)
        if (this.builder.out)
            await ControllerBuilder.scan(this.builder.out)

        Logger.info('Server Started', this.server)

        Logger.log(LBadge.info('Server Started'), (`http://localhost:${port}`))
        return this;
    }
}