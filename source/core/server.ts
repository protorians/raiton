import "../requirements";
import Fastify, {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import swagger from "@fastify/swagger";
import fastifyMultipart from "@fastify/multipart";
import path from "node:path";
import jwt from "@fastify/jwt";
import {Logger} from "@protorians/logger";
import {isControllerFile, parseParametersArguments, swaggerHtmlPagePlugin, SYSTEM_DECORATORS_KEYS} from "@/sdk";
import {EventBus, EventBusEnum} from "@protorians/events-bus";
import {
    ServerControllerInterface, ServerFeaturesUsed,
    ServerHMRDeclaration, ServerInterface, ServerOptions, ServerSignalMap,
} from "@/types";
import {env} from "@/sdk/env";
import {Raiton} from "@/core/raiton";
import {registryRoutes} from "@/sdk/routes";
import {RaitonDirectories} from "@/core/directories";
import fs from "node:fs";
import {ISignalStack, Signal} from "@protorians/core";


export class RaitonServer implements ServerInterface {

    protected readonly _runner: FastifyInstance;
    protected readonly _feature: ServerFeaturesUsed = new Map();

    readonly controllers: Map<string, ServerControllerInterface> = new Map();
    readonly signals: ISignalStack<ServerSignalMap> = new Signal.Stack<ServerSignalMap>();

    public constructor(
        public readonly options: ServerOptions,
    ) {
        this._runner = Fastify({
            logger: options.verbose,
            trustProxy: options.trustProxy,
        })
    }

    public get runner(): FastifyInstance {
        return this._runner;
    }

    public get feature(): ServerFeaturesUsed {
        return this._feature;
    }

    public async useAuthenticate(): Promise<this> {
        this.runner.register(jwt, {
            secret: env<string>('APP_KEY') || `${Raiton.identifier}:secret@not-defined`,
        });
        this.runner.decorate(
            "authenticate",
            async function (request: any, reply: any) {
                try {
                    Logger.log('Authenticating...', request.headers.authorization);
                    await request.jwtVerify();
                } catch (err) {
                    Logger.error('Authentication failed:', err);
                    reply.send(err);
                }
            }
        );
        this.feature.set('authenticate', true);
        return this;
    }

    public async useFormbody(): Promise<this> {
        await this.runner.register(await import('@fastify/formbody'));
        this.feature.set('formbody', true);
        return this;
    }

    public async useMultipart(): Promise<this> {
        await this.runner.register(fastifyMultipart, {
            attachFieldsToBody: false,
            limits: {
                fileSize: env<number>('APP_UPLOAD_LIMIT_FILES_IZE') || 2 * 1024 * 1024 * 1024,
                fieldNameSize: env<number>('APP_UPLOAD_LIMIT_FILES_IZE') || 100,
                fieldSize: env<number>('APP_UPLOAD_LIMIT_FILES_IZE') || 100,
                fields: env<number>('APP_UPLOAD_LIMIT_FILES_IZE') || 10,
                files: env<number>('APP_UPLOAD_LIMIT_FILES_IZE') || 1,
                headerPairs: env<number>('APP_UPLOAD_LIMIT_FILES_IZE') || 2000,
                parts: env<number>('APP_UPLOAD_LIMIT_FILES_IZE') || 1000,
            }
        });
        this.feature.set('multipart', true);
        return this;
    }

    /**
     * Development ONLY
     */
    public async useSwagger(): Promise<this> {
        this.feature.set('swagger', true);
        if (this.options.develop) {
            await this.runner.register(swagger, {
                openapi: {
                    info: {
                        title: `${Raiton.identifier} API { ${env<string>('APP_ENV') || 'development' || 'production'}`,
                        version: "1.0.0",
                        description: `${Raiton.identifier} API`
                    },
                },
            });

            this.runner.get("/docs", async (_, reply) =>
                reply.type("text/html").send(swaggerHtmlPagePlugin()));
            this.runner.get("/docs/json", async () => this.runner.swagger());

        }
        return this;
    }

    public async usePublicDirectory(directory?: string): Promise<this> {
        this.runner.register(require('@fastify/static'), {
            root: directory ?? path.join(this.options.workdir, 'public'),
        });
        this.feature.set('public.dir', true);
        return this;
    }

    protected async requirements() {
        EventBus.subscribe(EventBusEnum.SERVER_STARTED, () => {
            if (this.options.develop)
                EventBus.dispatch(EventBusEnum.SERVER_DEBUG, {
                    runner: this._runner,
                    ...this.options,
                })
        })

        return this;
    }

    public async prepare(): Promise<this> {
        await this.requirements();

        this.signals.listen('hmr:controller', async (payload) => {
            await this.controllerHmr(payload)
        })
        return this;
    }

    public async controllerHmr({filename, timestamp}: ServerHMRDeclaration) {
        if (!fs.existsSync(filename)) return;

        if (isControllerFile(filename)) {
            const controller = await import(`${filename}?t=${timestamp}`);
            const check = controller.default && typeof controller.default === 'function';

            if (check) {
                this.controllers.set(filename, this.parseController(controller.default, filename))
                Logger.debug('HMR', filename)
            }
        }
    }

    public parseController(controller: any, filename: string): ServerControllerInterface {
        const prefix = Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.CONTROLLERS, controller);
        const routes = Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.ROUTES, controller) || [];


        return {
            prefix,
            instance: (...args: any[]): Record<string, Function> => new controller(...(args || [])),
            filename,
            routes: routes.map((route: any) => {
                return {
                    method: route.method as string,
                    path: route.path as string,
                    name: route.handlerName as string,
                    url: `${prefix}${(route.path !== '/' ? route.path : '')}`,
                    paramsMetadata: Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.ROUTES_PARAMETERS, controller, route.handlerName) || [],
                    schema: Reflect.getMetadata(SYSTEM_DECORATORS_KEYS.ROUTES_SCHEMES, controller, route.handlerName) as object,
                }
            }),
            handler: (name: string, paramsMetadata: any[] = []) => {
                return async (req: FastifyRequest, reply: FastifyReply) => {
                    try {
                        const ctrl = this.controllers.get(filename);
                        if (!ctrl) throw new Error(`Controller ${filename} not found`);

                        const instance = ctrl.instance();

                        return await instance[name]?.(...(await parseParametersArguments(req, reply, paramsMetadata)));
                    } catch (err) {
                        return reply.status(500).send(err);
                    }
                }
            },
        }
    }

    public addController(controller: any, filename: string, runner?: FastifyInstance): this {
        runner = runner || this._runner;
        const parsed = this.parseController(controller, filename);

        this.controllers.set(filename, parsed)
        parsed.routes.forEach(({schema, method, url, name, paramsMetadata}) => {
            runner.route({
                method,
                url,
                schema: schema,
                handler: parsed.handler(name, paramsMetadata),
            });
        });
        return this;
    }

    public async registerControllers(runner?: FastifyInstance): Promise<this> {
        runner = runner || this._runner;
        const source = RaitonDirectories.server(Raiton.thread.builder.workdir);
        const directories = fs.readdirSync(source, {recursive: true, encoding: "utf-8"})
            .map(file => path.join(source, file.toString()))
        ;

        for (let file of directories) {
            if (isControllerFile(file)) {
                const controller = await import(file);
                controller.default &&
                typeof controller.default === 'function' &&
                this.addController(controller.default, file, runner);
            }
        }

        return this;
    }

    public async start(): Promise<this> {
        try {
            const port = this.options.port || 5711;

            this._runner.register((runner, _, done) => {
                this.registerControllers(runner)
                    .then(async () => {
                        await registryRoutes(runner)
                        done();
                    })
            }, {
                prefix: this.options.prefix,
            })

            this._runner.listen({port}, (err) => {
                if (err) {
                    Logger.error('Server Error', err)
                    process.exit(1)
                }

                if (this.options.develop && this.feature.has('swagger'))
                    Logger.info(`[Docs at http://localhost:${port}/docs]`);

                Logger.log(`Starting server at http://localhost:${port}`);
                EventBus.dispatch(EventBusEnum.SERVER_STARTED, {server: this.runner})
                this.signals.dispatch('ready', undefined)
            });


        } catch (e) {
            this.signals.dispatch('errors', e)
            Logger.error('Throwable', e)
        }

        return this;
    }

}