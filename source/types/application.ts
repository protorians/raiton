import {HttpMethod} from "@/sdk";

export interface ApplicationConfig {
    workdir?: string;
    hostname?: string;
    port?: number;
    protocole?: 'http' | 'https';
    pathname?: string;
    prefix?: string;
    develop?: boolean;
    verbose?: boolean;
}

export interface ApplicationInterface {
    readonly config: ApplicationConfig;

    get hostname(): string;

    // setOption<K extends keyof ApplicationConfig>(key: K, value: ApplicationConfig[K]): this;
    //
    // setOptions(options: ApplicationConfig): this;

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