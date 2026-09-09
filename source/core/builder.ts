import {RaitonConfig} from "./config/index.ts";
import path from "node:path";
import {RaitonDirectories} from "./directories.ts";
import fs, {WatchEventType} from "node:fs";
import type {BuilderConfigInterface, BuilderInterface, ThreadInterface,} from "../types/index.ts";
import {RaitonThread} from "./thread.ts";
import {Raiton} from "./raiton.ts";
import {ControllerBuilder} from "./controller/index.ts";
import {watch} from "fs";
import {LBadge, Logger} from "@protorians/logger";
import {Throwable} from "../framework/exceptions/index.ts";
import {Artifacts, HMR_CHANNELS, HmrChannel} from "../framework/artifacts.ts";
import {build} from "esbuild";
import {execSync, spawn, spawnSync} from "node:child_process";
import {isNodeUsed} from "../bin/constants.ts";

export class RaitonBuilder implements BuilderInterface {
    protected _source: string | null = null;
    protected _out: string | null = null;
    protected _bootstrapper: string | null = null;
    protected _bootstrapperFile: string | null = null;
    protected _compiledVersionNumber: number = 1;
    protected _watcher?: fs.FSWatcher;


    constructor(
        public readonly workdir: string,
        public readonly options: BuilderConfigInterface = {},
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

        const classification = Artifacts.classify(filename)
        if (!classification) return

        // Sur Node, le rechargement d'artefacts TypeScript en mémoire n'est pas
        // possible (import() natif des fichiers .ts). On bascule alors sur le
        // redémarrage de processus via IPC RESTART géré par la commande `develop`.
        if (isNodeUsed) {
            Raiton.thread?.restart()
            return
        }

        const payload = {
            filename,
            timestamp: Date.now(),
            version: this._compiledVersionNumber,
            type,
            channel: classification.channel,
            artifactType: classification.artifactType,
        }

        Raiton.signals.dispatch(classification.channel as any, payload)
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
        this._bootstrapperFile = path.join(RaitonDirectories.server(this.workdir), RaitonDirectories.compiledBootstrapFile)

        return this;

    }

    public async prepare(): Promise<this> {
        await this.initialize()

        if (this.options.hmr && this.options.serve) {
            this.listenHmrDi()
            this.listenHmrController()
            this.listenHmrSocket()
            this.listenHmrMiddleware()
            this.listenHmrHook()
            this.listenHmrMcp()
            this.watching();
        }

        return this;
    }

    protected listenHmrDi(): void {
        Raiton.signals.listen(
            'hmr:di',
            async ({filename, version, timestamp}) => {
                const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
                Artifacts.reloadDi(imported, filename)
                Logger.log(LBadge.debug('HMR'), `[di] ${path.relative(this.workdir, filename)}`)
            }
        )
    }

    protected listenHmrController(): void {
        Raiton.signals.listen(
            'hmr:controller',
            async ({filename, version, timestamp}) => {
                const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
                await ControllerBuilder.recompile(imported, filename)
                Logger.log(LBadge.debug('HMR'), `[controller] ${path.relative(this.workdir, filename)}`)
            }
        )
    }

    protected listenHmrSocket(): void {
        Raiton.signals.listen(
            'hmr:socket',
            async ({filename, version, timestamp}) => {
                const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
                await ControllerBuilder.build({filename, version, timestamp})
                Logger.log(LBadge.debug('HMR'), `[socket] ${path.relative(this.workdir, filename)}`)
            }
        )
    }

    protected listenHmrMiddleware(): void {
        Raiton.signals.listen(
            'hmr:middleware',
            async ({filename, version, timestamp}) => {
                const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
                Artifacts.reloadMiddleware(imported, filename)
                Logger.log(LBadge.debug('HMR'), `[middleware] ${path.relative(this.workdir, filename)}`)
            }
        )
    }

    protected listenHmrHook(): void {
        Raiton.signals.listen(
            'hmr:hook',
            async ({filename, version, timestamp}) => {
                const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
                Artifacts.reloadHook(imported, filename)
                Logger.log(LBadge.debug('HMR'), `[hook] ${path.relative(this.workdir, filename)}`)
            }
        )
    }

    protected listenHmrMcp(): void {
        Raiton.signals.listen(
            'hmr:mcp',
            async ({filename, version, timestamp}) => {
                const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
                Artifacts.reloadMcp(imported, filename)
                Logger.log(LBadge.debug('HMR'), `[mcp] ${path.relative(this.workdir, filename)}`)
            }
        )
    }

    protected async build(thread: ThreadInterface): Promise<this> {
        if (!this._source) throw new Error('Application source not found');
        if (!this._out) throw new Error('Application output not found');
        if (!this.bootstrapper) throw new Error('Bootstrapper not found')
        if (!this.bootstrapperFile) throw new Error('Bootstrapper file not found')

        const source = path.relative(this.workdir, this._source)
        const output = path.relative(this.workdir, this._out)

        Logger.log(LBadge.notice('Building'), 'application');
        Logger.log(LBadge.info('Source'), source);
        Logger.log(LBadge.info('Output'), output);

        await this.typecheck()
        await this.compile()

        return this;
    }

    protected async typecheck(): Promise<this> {
        const tsconfigPath = path.join(this.workdir, 'tsconfig.json')
        if (!fs.existsSync(tsconfigPath)) return this

        try {
            execSync(`cd ${this.workdir} && npx tsc -p tsconfig.json --noEmit`, {stdio: 'inherit'})
        } catch (e: any) {
            Logger.warn('TypeScript check reported errors', e?.message ?? e)
        }

        return this;
    }

    protected async compile(): Promise<this> {
        if (!this._source) throw new Error('Application source not found');
        if (!this._out) throw new Error('Application output not found');
        if (!this.bootstrapper) throw new Error('Bootstrapper not found')

        const outfile = this.bootstrapperFile
        if (!outfile) throw new Error('Bootstrapper file not found')

        await build({
            entryPoints: [this.bootstrapper],
            bundle: true,
            platform: 'node',
            format: 'esm',
            target: 'node20',
            outfile,
            sourcemap: true,
            packages: 'external',
            external: ['@protorians/*', 'argon2', 'bcrypt'],
        })

        return this;
    }

    public async boot(): Promise<any> {
        if (!this.bootstrapper) throw new Error('Bootstrapper not found')

        let entry = this.bootstrapper

        if (isNodeUsed) {
            const compiled = this.bootstrapperFile
            if (!compiled) throw new Error('Bootstrapper file not found')
            if (!fs.existsSync(compiled)) await this.compile()
            entry = compiled
        }

        if (!fs.existsSync(entry))
            throw new Error(`Bootstrapper file "${entry}" does not exists`)

        const bootstrapper = await import(entry);
        if (!('default' in bootstrapper))
            throw new Error('Bootstrapper not supported! Please export to "default"')

        const thread = new RaitonThread(this, {serve: this.options.serve})
        Raiton.thread = thread;
        const app = await bootstrapper.default(thread);

        if (!this.options.serve) await this.build(thread)

        return app;
    }

}
