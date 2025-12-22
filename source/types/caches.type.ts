export interface CacheMetadataInterface {
    version: number;
    timestamp: number;
    filename: string;
}

export interface CacheManagerInterface {
    entries(): Record<string, CacheMetadataInterface>;

    set(key: string, filename: string): this;

    get(key: string): CacheMetadataInterface | undefined;

    getKeys(): string[];

    getValues(): Array<CacheMetadataInterface>;

    getEntries(): Array<[string, CacheMetadataInterface]>;

    each(callable: (value: CacheMetadataInterface, key: string, map: Map<string, CacheMetadataInterface>) => void| Promise<void>): Promise<this>

    unset(key: string): this;

    clear(): this;

    load<T>(key: string): Promise<T | undefined>;

    reload<T>(key: string): Promise<T | undefined>;

    has(key: string): boolean;

    upsert<T>(key: string, filename: string): Promise<T | undefined>;

    size(): number;

    refresh(): Promise<this>;

}