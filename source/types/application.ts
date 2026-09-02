import {HttpMethod} from "../framework";
import {HttpsConfigInput, HttpsConfigInterface} from "../framework/utilities/https";

export interface ApplicationConfigInterface {
    workdir?: string;
    hostname?: string;
    port?: number;
    protocole?: 'http' | 'https';
    pathname?: string;
    prefix?: string;
    develop?: boolean;
    verbose?: boolean;
    https?: HttpsConfigInput;
}

export interface ApplicationInterface {
    readonly config: ApplicationConfigInterface;

    get hostname(): string;

    get https(): HttpsConfigInterface | undefined;

    setOption<K extends keyof ApplicationConfigInterface>(key: K, value: ApplicationConfigInterface[K]): this;

    setOptions(options: ApplicationConfigInterface): this;

    register(plugin: any): this;

    use(mw: any): this;

    route(method: HttpMethod, path: string, handler: any, version?: string): this

    get(path: string, handler: any, version?: string): this;

    post(path: string, handler: any, version?: string): this;

    patch(path: string, handler: any, version?: string): this;

    put(path: string, handler: any, version?: string): this;

    delete(path: string, handler: any, version?: string): this;

    options(path: string, handler: any, version?: string): this;

    head(path: string, handler: any, version?: string): this;

    trace(path: string, handler: any, version?: string): this;

    handle(req: any, reply: any): Promise<any>;
}