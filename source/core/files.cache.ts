import {CacheManagerInterface, CacheMetadataInterface} from "@/types";


export class FilesCache implements CacheManagerInterface {
    protected files: Map<string, CacheMetadataInterface> = new Map();

    set(file: string, filename: string) {
        this.files.set(file, {
            filename,
            version: 1,
            timestamp: Date.now()
        });
        return this;
    }

    clear(): this {
        this.files.clear();
        return this;
    }

    entries(): Record<string, CacheMetadataInterface> {
        return Object.fromEntries(this.files.entries());
    }

    has(key: string): boolean {
        return this.files.has(key);
    }

    async refresh(): Promise<this> {
        await this.each(async (file, key) => await this.upsert(key, file.filename));
        return this;
    }

    async load<T>(key: string): Promise<T | undefined> {
        const file = this.files.get(key);
        return file ? await import(`${file.filename}?t=${file.timestamp}&v=${file.version}`) : undefined;
    }

    async reload<T>(key: string): Promise<T | undefined> {
        const file = this.files.get(key);

        if(!file) return undefined;

        file.version++
        file.timestamp = Date.now();

        this.files.set(key, file);

        return await import(`${file.filename}?t=${file.timestamp}&v=${file.version}`);
    }

    unset(key: string): this {
        this.files.delete(key);
        return this;
    }

    size(): number {
        return this.files.size;
    }

    async each(callable: (value: CacheMetadataInterface, key: string, map: Map<string, CacheMetadataInterface>) => void | Promise<void>): Promise<this> {
        await Promise.all([...this.files.entries()].map(async ([key, value]) => await callable(value, key, this.files)));
        return this;
    }

    get(key: string): CacheMetadataInterface | undefined {
        return this.files.get(key);
    }

    getEntries(): Array<[string, CacheMetadataInterface]> {
        return [...this.files.entries()];
    }

    getKeys(): string[] {
        return [...this.files.keys()];
    }

    getValues(): Array<CacheMetadataInterface> {
        return [...this.files.values()];
    }

    async upsert<T>(key: string, filename: string): Promise<T | undefined> {
        let file: CacheMetadataInterface | undefined = this.files.get(key);

        if (!file) {
            this.set(key, filename);
            file = this.files.get(key);
        }

        if (!file) return undefined;

        file.version++;
        file.timestamp = Date.now();

        return await this.load(key);
    }
}