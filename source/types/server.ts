export interface ServerInterface {
    readonly options: ServerOptionsInterface;

    option<K extends keyof ServerOptionsInterface>(key: K): ServerOptionsInterface[K];
}

export interface ServerOptionsInterface {
    os?: string;
    arch?: string;
    ip?: string;
    port?: string;
}