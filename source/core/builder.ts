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
import {execSync, spawn, spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import {isNodeUsed} from "../bin/constants.ts";
import {invalidateManifest} from "../manifest/manifest.ts";
import {rotateDebugBuild} from "../debug/runtime.ts";
import {invalidateSourceCache} from "../debug/source.ts";
import {BridgeLoader} from "./bridge/loader.ts";
import {isSameFile, isWithin, resolveBridgeSource} from "./bridge/paths.ts";
import {BridgeError} from "./bridge/diagnostics.ts";

export class RaitonBuilder implements BuilderInterface {
    protected _source: string | null = null;
    protected _out: string | null = null;
    protected _bootstrapper: string | null = null;
    protected _bootstrapperFile: string | null = null;
    protected _compiledVersionNumber: number = 1;
    protected _watcher?: fs.FSWatcher;
    protected _bridgeWatcher?: fs.FSWatcher;


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
        const configuredBridge = resolveBridgeSource(this.workdir)
        const bridgePath = configuredBridge.file ?? configuredBridge.expected
        if (bridgePath && isSameFile(filename, bridgePath) && !fs.existsSync(filename)) {
            invalidateManifest()
            invalidateSourceCache()
            rotateDebugBuild()
            if (isNodeUsed) {
                Raiton.thread?.restart()
                return
            }
            return await BridgeLoader.reload({workdir: this.workdir, development: true})
        }

        if (!fs.existsSync(filename)) return;

        const bridge = resolveBridgeSource(this.workdir)
        if (bridge.file && isSameFile(filename, bridge.file)) {
            invalidateManifest()
            invalidateSourceCache()
            rotateDebugBuild()

            if (isNodeUsed) {
                Raiton.thread?.restart()
                return
            }

            const state = await BridgeLoader.reload({workdir: this.workdir, development: true})
            Logger.log(
                LBadge.debug('HMR'),
                `[bridge] ${path.relative(this.workdir, filename)} (${state.artifacts.length} artifact(s))`
            )
            return state
        }

        const classification = Artifacts.classify(filename)
        if (!classification) return

        // Any source change makes the cached inventory stale.
        invalidateManifest()
        invalidateSourceCache()
        rotateDebugBuild()

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

        // A configured bridge may live outside the source directory. Watch the
        // single file explicitly instead of widening the recursive scan.
        const bridge = resolveBridgeSource(this.workdir)
        if (bridge.file && !isWithin(this._source, bridge.file)) {
            try {
                this._bridgeWatcher = watch(bridge.file, (event) => {
                    this.parse(bridge.file!, event as WatchEventType).catch(error => {
                        Logger.error('[bridge] reload failed', error?.message ?? error)
                    })
                });
            } catch (error: any) {
                Logger.debug('[bridge] cannot watch bridge file', error?.message ?? error)
            }
        }

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
            this.listenHmrScheduler()
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

    protected listenHmrScheduler(): void {
        Raiton.signals.listen(
            'hmr:scheduler',
            async ({filename, version, timestamp}) => {
                const imported = await import(`${filename}?v=${version || 1}&t=${timestamp || Date.now()}`)
                Artifacts.reloadScheduler(imported, filename)
                Logger.log(LBadge.debug('HMR'), `[scheduler] ${path.relative(this.workdir, filename)}`)
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
        await this.validateBridgeOutput()

        return this;
    }

    /**
     * Node production cannot dynamically import TypeScript files. Validate the
     * compiled manifest after the build so a local `.ts` entry fails at build
     * time with an actionable diagnostic instead of at startup.
     */
    protected async validateBridgeOutput(): Promise<this> {
        if (!isNodeUsed || !this._out) return this;
        const bridge = resolveBridgeSource(this.workdir);
        if (!bridge.file) return this;

        const compiled = path.join(this._out, "artifacts.bridge.mjs");
        if (!fs.existsSync(compiled)) return this;

        let imported: any;
        try {
            imported = await import(pathToFileURL(compiled).href);
        } catch (error: any) {
            throw new BridgeError("BRIDGE_IMPORT_FAILED", {
                message: `Compiled bridge failed to load: ${error?.message ?? error}`,
                location: compiled,
            });
        }

        const definition = imported?.default ?? imported;
        if (!definition || !Array.isArray(definition.artifacts)) {
            throw new BridgeError("BRIDGE_FILE_INVALID_EXPORT", {
                message: "The compiled bridge does not export a valid definition",
                location: compiled,
            });
        }

        for (const entry of definition.artifacts) {
            if (typeof entry !== "string") continue;
            if (!/^(\.\.?\/|\/)/.test(entry)) continue;
            if (/\.(ts|mts|cts|tsx)$/i.test(entry)) {
                throw new BridgeError("BRIDGE_RUNTIME_UNSUPPORTED", {
                    message: `Local bridge entry is TypeScript and cannot be imported on Node.js: ${entry}`,
                    action: "Import the class directly in artifacts.bridge.ts (recommended) or compile the file to JavaScript.",
                    location: compiled,
                    entry,
                });
            }
        }

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

        const bridge = resolveBridgeSource(this.workdir)
        if (bridge.explicit && !bridge.file) {
            throw new BridgeError("BRIDGE_FILE_NOT_FOUND", {
                location: bridge.expected ?? this.workdir,
                entry: bridge.expected ?? undefined,
            })
        }

        const {build} = await import("esbuild")
        const shared = {
            bundle: true,
            platform: 'node' as const,
            format: 'esm' as const,
            target: 'node20',
            sourcemap: true,
            packages: 'external' as const,
            external: ['@protorians/*', 'argon2', 'bcrypt'],
        }

        if (bridge.file) {
            // Two explicit entry points: the application bootstrapper and the
            // bridge manifest. `outExtension` keeps the documented `.mjs`
            // names (`main.mjs`, `artifacts.bridge.mjs`).
            await build({
                ...shared,
                entryPoints: [
                    {in: this.bootstrapper, out: 'main'},
                    {in: bridge.file, out: 'artifacts.bridge'},
                ],
                outdir: this._out,
                outExtension: {'.js': '.mjs'},
            })
            Logger.log(LBadge.info('Bridge'), path.relative(this.workdir, bridge.file));
            return this;
        }

        await build({
            ...shared,
            entryPoints: [this.bootstrapper],
            outfile,
        })

        return this;
    }

    public async boot(): Promise<any> {
        if (!this.bootstrapper) throw new Error('Bootstrapper not found')

        let entry = this.bootstrapper

        if (isNodeUsed) {
            const compiled = this.bootstrapperFile
            if (!compiled) throw new Error('Bootstrapper file not found')
            const bridge = resolveBridgeSource(this.workdir)
            const bridgeCompiled = bridge.file
                ? path.join(this._out!, "artifacts.bridge.mjs")
                : null
            // Development on Node uses the controlled restart, so the source
            // must be recompiled on every boot. Production reuses an existing
            // build; a missing file (or bridge output) triggers a compile.
            const needsCompile = this.options.hmr
                || !fs.existsSync(compiled)
                || Boolean(bridgeCompiled && !fs.existsSync(bridgeCompiled))
            if (needsCompile) await this.compile()
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

        if (!this.options.serve && this.options.compile !== false) await this.build(thread)

        return app;
    }

}
