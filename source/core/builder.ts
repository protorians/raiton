import {Plugin, BuildContext, BuildOptions, context, Metafile, build} from 'esbuild'
import {RaitonConfig} from "./config";
import path from "node:path";
import {RaitonDirectories} from "./directories";
import {LBadge, Logger} from "@protorians/logger";
import fs from "node:fs";
import {formatBytes} from "./bytes.util";
import {ISignalStack, ProcessUtility, Signal} from "@protorians/core";
import type {
    BuilderBootCallable,
    BuilderConfig,
    BuilderInterface,
    BuilderSignalMap,
    HmrInterface
} from "@/types";
import * as process from "node:process";
import {EventMessageEnum} from "@/sdk/enums";
import {until} from "./process.util";
import {RaitonThread} from "./thread";
import sleep = ProcessUtility.sleep;
import {Raiton} from "@/core/raiton";
import {EventBus, EventBusEnum} from "@protorians/events-bus";
import {isControllerFile} from "@/sdk";
import {Hmr} from "@/core/hmr";

export class RaitonBuilder implements BuilderInterface {

    protected _context: BuildContext<BuildOptions> | null = null;
    protected _source: string | null = null;
    protected _out: string | null = null;
    protected _bootstrapper: string | null = null;
    protected _bootstrapperIndex: string | null = null;
    protected config: BuildOptions | null = null;
    protected _compiledVersionNumber: number = 1;
    protected _importPattern = /from\s+["'](\.\.?\/[^."'][^"']*)["']/g;

    public readonly hmr: HmrInterface = new Hmr()
    public readonly signal: ISignalStack<BuilderSignalMap> = new Signal.Stack()

    constructor(
        public readonly workdir: string,
        public readonly options: BuilderConfig = {},
    ) {

    }

    public get context(): BuildContext<BuildOptions> | null {
        return this._context;
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

    public get bootstrapperIndex(): string | null {
        return this._bootstrapperIndex
    }

    public get baseConfig(): BuildOptions {
        return {
            absWorkingDir: this.workdir,

            // write: false,
            splitting: true,
            bundle: false,
            // preserveSymlinks: false,

            platform: "node",
            sourcemap: true,
            minify: false,
            format: 'esm',
            target: 'node22',
            metafile: true,
            // bundle: false,
            tsconfig: path.join(this.workdir, "tsconfig.json"),
            plugins: [
                this.watcher(),
            ]
        }
    }


    protected generateUniqueModuleUrl(filename: string) {
        return `${filename}?t=${Date.now()}&v=${this._compiledVersionNumber}&r=${Math.random()}&hmr=1&${Math.random()}`
    }

    protected async refreshFileCached(filename: string) {

        try {
            const url = this.generateUniqueModuleUrl(filename);
            const mod = await import(url);

            if (!mod) throw new Error('Module is invalid')

            Logger.log('Refreshed', path.relative(Raiton.thread.builder.workdir, url))
            return mod;
        } catch (er) {
            Logger.error('Failed to refresh file', filename, er)
            return null;
        }

    }

    protected async fixImports(pathname: string) {
        if (!pathname.endsWith(".js")) return;


        let code = await fs.promises.readFile(pathname, "utf8");

        const match = this._importPattern.test(code);
        if (!match) return;

        this._importPattern.lastIndex = 0;
        const updated = code.replace(this._importPattern, (match, detected) => {
            return match.replace(detected, detected + ".js");
        });

        return await fs.promises.writeFile(pathname, updated);
    }

    protected watcher(): Plugin {
        const temporary = new Map<string, Metafile['inputs'][keyof Metafile['inputs']]>();
        const this_ = this;
        const importPattern = /from\s+["'](\.\.?\/[^."'][^"']*)["']/g;

        const updateVersionNumber = () => this._compiledVersionNumber++;
        const getVersionNumber = () => this._compiledVersionNumber;
        const refreshFileCached = async (filename: string) =>
            await this.refreshFileCached(filename)

        let hmrMoment: boolean = false;

        return {
            name: `${Raiton.identifier}-build-plugin`,
            setup(build) {

                build.onEnd(async (result) => {
                    if (result.errors.length) Logger.error('Errors:\n—', result.errors.join('\n—'))
                    if (result.warnings.length) Logger.error('Warnings:\n—', result.warnings.join('\n—'))


                    if (result.metafile) {
                        const outputs = Object.keys(result.metafile.outputs);

                        // const bootstrapper = this_._bootstrapperIndex ? result.metafile.outputs[this_._bootstrapperIndex] : undefined;
                        // const imports = bootstrapper?.imports.map(e => path.join(RaitonConfig.get('rootDir'), `${e.path}.ts`))
                        // Logger.debug('Stack', result.metafile)

                        /**
                         * Outgoing
                         */
                        for (const key of outputs) {
                            const filename = path.resolve(key);
                            await this_.fixImports(filename)

                            // if (!fs.existsSync(filename)) continue;
                            // const metadata = result.metafile.outputs[key];
                            // Logger.debug('OUT', filename, metadata.bytes)
                            // await this_.hmr.upsert(key, filename, metadata.bytes)

                            if (hmrMoment && isControllerFile(filename)) {
                                Raiton.server.signals.dispatch('hmr:controller', {
                                    filename,
                                    timestamp: Date.now(),
                                    version: getVersionNumber()
                                })
                            }

                        }

                        //
                        //     /**
                        //      * Incoming
                        //      */
                        //     for (const [key, meta] of Object.entries(result.metafile.inputs)) {
                        //         const size = temporary.get(key)?.bytes
                        //         if (size && meta.bytes === size) continue;
                        //
                        //         temporary.set(key, meta)
                        //         Logger.log('Update', LBadge.info(key), `— size: ${formatBytes(meta.bytes)}`, hmrMoment)
                        //
                        //         if (!hmrMoment) continue;
                        //
                        //         if (imports?.includes(key) || (bootstrapper && key === bootstrapper?.entryPoint)) {
                        //             process.send?.(EventMessageEnum.RESTART)
                        //             Logger.debug('HMR', key, 'changed — reload...', process.send);
                        //             break;
                        //         }
                        //
                        //         const out = Object.entries(result.metafile.outputs)
                        //             .map(([output, meta]) => {
                        //                 return {
                        //                     output,
                        //                     is: meta.entryPoint === key
                        //                 }
                        //             })
                        //             .filter(({is}) => is)[0] || undefined;
                        //
                        //         if (out && out.is) {
                        //             const absolutePath = path.join(Raiton.thread.builder.workdir, out.output);
                        //
                        //             if (isControllerFile(out.output)) {
                        //                 Raiton.server.signals.dispatch('hmr:controller', {
                        //                     filename: absolutePath,
                        //                     timestamp: Date.now(),
                        //                     version: getVersionNumber()
                        //                 })
                        //                 continue;
                        //             }
                        //
                        //             await refreshFileCached(absolutePath)
                        //         }
                        //
                        //     }
                        //

                    }

                    if (hmrMoment) {
                        // Raiton.server.signals.dispatch('hmr:triggered', result.metafile)
                        updateVersionNumber()
                        // await registryControllers(Raiton.server.runner)
                    }

                    hmrMoment = true;
                });
            },
        };
    }

    protected async developmentBuild(callable?: BuilderBootCallable) {
        if (!this._context)
            throw new Error('Builder not prepared')

        this.context?.watch()
            .then(async () => {
                await sleep(60)
                await until(() => this._bootstrapper ? fs.existsSync(this._bootstrapper) : false)
                callable?.(this)
            })
            .catch((err) => Logger.error('Stack:\n', err))
        return this;
    }

    protected async productionBuild(callable?: BuilderBootCallable) {
        if (!this.config)
            throw new Error('Builder not prepared')

        await build(this.config)
        callable?.(this)
        return this;
    }

    public async prepare(): Promise<this> {
        this._source = path.resolve(this.workdir, RaitonConfig.get('rootDir'));
        this._out = path.resolve(this.workdir, RaitonDirectories.server(this.workdir));

        if (!fs.existsSync(this._source))
            throw new Error(`Source directory "${this._source}" does not exists`)

        if (!fs.existsSync(this._out))
            fs.mkdirSync(this._out, {recursive: true})


        this._bootstrapper = path.join(this._out, RaitonDirectories.bootstrapFile)
        this._bootstrapperIndex = path.join(RaitonDirectories.server('./'), RaitonDirectories.bootstrapFile)

        this.config = {
            ...this.baseConfig,
            entryPoints: [`${RaitonConfig.get('rootDir')}/**/*.ts`,],
            outdir: RaitonDirectories.server('./'),
        }

        if (this.options.development) {
            this._context = await context(this.config);
        }

        if (!this.options.development) {
        }

        return this;
    }

    public async boot(): Promise<any> {
        if (!this.bootstrapper) throw new Error('Bootstrapper not found')
        if (!fs.existsSync(this.bootstrapper))
            throw new Error(`Bootstrapper file "${this.bootstrapper}" does not exists`)

        const bootstrapper = await import(this.bootstrapper);
        if (!('default' in bootstrapper))
            throw new Error('Bootstrapper not supported! Please export to "default"')

        Raiton.thread = new RaitonThread({builder: this,})
        return bootstrapper.default(Raiton.thread)
    }

    public async start(callable?: BuilderBootCallable): Promise<this> {
        return (this.options.development)
            ? await this.developmentBuild(callable)
            : await this.productionBuild(callable);
    }

}