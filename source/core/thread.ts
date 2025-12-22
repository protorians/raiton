import type {
    ThreadInterface,
    ThreadOptions,
    BuilderInterface,
    ThreadWaitCallable,
    ServerOptions, ServerInterface
} from "@/types";
import {EventMessageEnum} from "@/sdk/enums";
import {ProcessUtility} from "@protorians/core";
import {until} from "./process.util";
import {RaitonServer} from "./server";
import {Raiton} from "@/core/raiton";

export class RaitonThread implements ThreadInterface {

    readonly appDir: string;
    readonly builder!: BuilderInterface;

    constructor(options?: ThreadOptions) {
        this.appDir = process.cwd();

        if (options) {
            for (const [key, value] of Object.entries(options)) {
                if (typeof value === 'function') continue
                this[key as keyof this] = value as this[keyof this]
            }
        }
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

    public async createApplication(options?: ServerOptions): Promise<ServerInterface> {
        Raiton.server = new RaitonServer({
            ...options,
            prefix: options?.prefix,
            develop: this.builder.options.development,
            workdir: options?.workdir || this.builder?.workdir || process.cwd(),
        })
        await Raiton.server.prepare();
        return Raiton.server;
    }
}