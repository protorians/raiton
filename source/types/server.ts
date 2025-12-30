import {FastifyInstance, FastifyReply, FastifyRequest} from "fastify";
import {ISchemeOptions} from "@/types/scheme";
import {TSchema} from "@sinclair/typebox";
import {ISignalStack} from "@protorians/core";
import {Metafile} from "esbuild";


export interface ServerOptions {
    workdir: string;
    prefix?: string;
    develop?: boolean;
    port?: number;
    verbose?: boolean;
    trustProxy?: boolean;
}

export type ServerFeaturesUsed = Map<string, any>

export interface ServerInterface {
    readonly options: ServerOptions;
    readonly controllers: Map<string, ServerControllerInterface>;
    readonly signals: ISignalStack<ServerSignalMap>;

    get runner(): FastifyInstance;

    get feature(): ServerFeaturesUsed;

    useAuthenticate(): Promise<this>;

    useFormbody(): Promise<this>;

    useMultipart(): Promise<this>;

    useSwagger(): Promise<this>;

    usePublicDirectory(directory?: string): Promise<this>;

    prepare(): Promise<this>;

    start(): Promise<this>;
}


export interface ServerRouteInterface {
    method: string;
    path: string;
    name: string;
    url: string;
    paramsMetadata: any[];
    schema?: ISchemeOptions<TSchema, TSchema, TSchema, Record<number, TSchema>> | undefined
}

export interface ServerControllerInterface {
    prefix: string;
    routes: ServerRouteInterface[];
    instance: (...args: any[]) => Record<string, Function>;
    filename?: string;
    handler: (handleName: string, params: any[]) => (req: FastifyRequest, reply: FastifyReply) => Promise<any>;
}

export interface ServerHMRDeclaration {
    filename: string;
    timestamp?: number;
    version?: number;
}

export interface ServerSignalMap {
    ready: undefined;
    errors: any;
    'hmr:controller': ServerHMRDeclaration;
    'hmr:triggered': Metafile | undefined;
}