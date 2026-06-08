import {RaitonConfig} from "./config";
import path from "node:path";
import {RaitonDirectories} from "./directories";
import fs, {WatchEventType} from "node:fs";
import type {BuilderConfig, BuilderInterface,} from "../types";
import {RaitonThread} from "./thread";
import {Raiton} from "./raiton";
import {isControllerArtifact, isServiceArtifact} from "../sdk";
import {ControllerBuilder} from "./controller";
import {watch} from "fs";
import {LBadge, Logger} from "@protorians/logger";
import {Throwable} from "../sdk/exceptions";
import {Injection} from "./injection";
import {Artifacts} from "../sdk/artifacts";

export class RaitonBuilder implements BuilderInterface {
    protected _source: string | null = null;
    protected _out: string | null = null;
    protected _bootstrapper: string | null = null;
    protected _bootstrapperFile: string | null = null;
    protected _compiledVersionNumber: number = 1;
    protected _watcher?: fs.FSWatcher;


    constructor(
        public readonly workdir: string,
        public readonly options: BuilderConfig = {},
    ) {

    }

    public get source(): string | null {
        return this._source;
    }

    public get out(): string | null {
        return this._out;
    }

    public get bootstrapper(): string | null {
        return this._bootstrapper;
    }

    public get bootstrapperFile(): string | null {
        return this._bootstrapperFile
    }

    public get watcher(): fs.FSWatcher | undefined {
        return this._watcher;
    }

    protected async parse(filename: string, type?: WatchEventType) {
        if (!fs.existsSync(filename)) return;

        const payload = {
            filename,
            timestamp: Date.now(),
            version: this._compiledVersionNumber,
            type
        }

        Logger.log(LBadge.info('HMR'), 'activated');

        if (isControllerArtifact(filename)) {
            Raiton.signals.dispatch('hmr:controller', payload)
        }

        if (Artifacts.is(filename))
            Artifacts.reload(
                await import(`${filename}?v=${payload.version || 1}&t=${payload.timestamp || Date.now()}`),
                filename
            )

        return payload;
    }

    protected async parsing(): Promise<this> {
        if (typeof this._source != 'string') throw new Throwable('Application source not found');

        for (const filename of [...fs.readdirSync(this._source, {recursive: true})])
            await this.parse(path.join(this._source, String(filename)));

        return this;
    }

    protected watching(): this {
        if (typeof this._source != 'string') throw new Throwable('Application source not found');

        this._watcher = watch(this._source, {recursive: true}, (event, relativePath) => {
            if (this._source && relativePath) {
                this.parse(path.join(this._source, relativePath));
            }
        });

        return this;
    }

    protected async initialize(): Promise<this> {
        const rootDir = RaitonConfig.get('rootDir') || './';
        this._source = path.resolve(this.workdir, rootDir);
        this._out = path.resolve(this.workdir, RaitonDirectories.server(this.workdir));

        if (!fs.existsSync(this._source))
            throw new Error(`Source directory "${this._source}" does not exists`)

        if (!fs.existsSync(this._out))
            fs.mkdirSync(this._out, {recursive: true})


        this._bootstrapper = path.join(this._source, RaitonDirectories.bootstrapFile)
        this._bootstrapperFile = path.join(RaitonDirectories.server('./'), RaitonDirectories.bootstrapFile)

        return this;

    }

    public async prepare(): Promise<this> {
        await this.initialize()
        Raiton.signals.listen(
            'hmr:controller',
            async ({filename, version, timestamp}) => {
                await ControllerBuilder.build({filename, version, timestamp})
            }
        )
        // this.parsing();
        this.watching();
        return this;
    }

    public async boot(): Promise<any> {
        if (!this.bootstrapper) throw new Error('Bootstrapper not found')
        if (!fs.existsSync(this.bootstrapper))
            throw new Error(`Bootstrapper file "${this.bootstrapper}" does not exists`)

        const bootstrapper = await import(this.bootstrapper);
        if (!('default' in bootstrapper))
            throw new Error('Bootstrapper not supported! Please export to "default"')

        const thread = new RaitonThread(this, {})
        Raiton.thread = thread;
        return await bootstrapper.default(thread);
    }

}