export interface ServerInterface {
    readonly options: ServerOptions;

    option<K extends keyof ServerOptions>(key: K): ServerOptions[K];
}

export interface ServerOptions {
    os?: string;
    arch?: string;
    ip?: string;
    port?: string;
}