export interface HMRMetadataInterface {
    version: number;
    timestamp: number;
    filename: string;
    size: number;
}

export interface HmrInterface {
    entries(): Record<string, HMRMetadataInterface>;

    set(key: string, filename: string, size: number): this;

    get(key: string): HMRMetadataInterface | undefined;

    getKeys(): string[];

    getValues(): Array<HMRMetadataInterface>;

    getEntries(): Array<[string, HMRMetadataInterface]>;

    each(callable: (value: HMRMetadataInterface, key: string, map: Map<string, HMRMetadataInterface>) => void| Promise<void>): Promise<this>

    unset(key: string): this;

    clear(): this;

    load<T>(key: string): Promise<T | undefined>;

    reload<T>(key: string): Promise<T | undefined>;

    has(key: string): boolean;

    upsert<T>(key: string, filename: string, size: number): Promise<T | undefined>;

    size(): number;

    refresh(): Promise<this>;

}