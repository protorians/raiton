import {HmrInterface, HMRMetadataInterface} from "@/types";
import {Logger} from "@protorians/logger";


export class Hmr implements HmrInterface {
    protected files: Map<string, HMRMetadataInterface> = new Map();

    set(file: string, filename: string, size: number = 0) {

        if(!filename.endsWith('.js')) return this;

        this.files.set(file, {
            filename,
            size,
            version: 1,
            timestamp: Date.now(),
        });
        return this;
    }

    clear(): this {
        this.files.clear();
        return this;
    }

    entries(): Record<string, HMRMetadataInterface> {
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
        Logger.log('HMR', file)

        const mod = file ? await import(`${file.filename}?t=${file.timestamp}&v=${file.version}`) : undefined;
        return mod as T | undefined;
    }

    async reload<T>(key: string): Promise<T | undefined> {
        const file = this.files.get(key);

        if (!file) return undefined;

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

    async each(callable: (value: HMRMetadataInterface, key: string, map: Map<string, HMRMetadataInterface>) => void | Promise<void>): Promise<this> {
        await Promise.all([...this.files.entries()].map(async ([key, value]) => await callable(value, key, this.files)));
        return this;
    }

    get(key: string): HMRMetadataInterface | undefined {
        return this.files.get(key);
    }

    getEntries(): Array<[string, HMRMetadataInterface]> {
        return [...this.files.entries()];
    }

    getKeys(): string[] {
        return [...this.files.keys()];
    }

    getValues(): Array<HMRMetadataInterface> {
        return [...this.files.values()];
    }

    async upsert<T>(key: string, filename: string, size: number = 0): Promise<T | undefined> {
        let file: HMRMetadataInterface | undefined = this.files.get(key);

        if (!file) {
            this.set(key, filename);
            file = this.files.get(key);
        }

        if (!file) return undefined;
        if (file.size === size) return undefined;

        file.version++;
        file.timestamp = Date.now();
        file.size = size;

        return await this.set(key, filename, size).load(key);
    }
}