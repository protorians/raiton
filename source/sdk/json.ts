import {IParseableEntries, IParseablePrimitiveEntry} from "../types/parseable";
import {stabilizeJson} from "./utilities";


export class Json<T extends IParseableEntries> {

    public readonly stack: Map<keyof T, T[keyof T]> = new Map();

    constructor(json: IParseablePrimitiveEntry<T>) {
        this.records(stabilizeJson<T>(json));
    }

    records(data: T): this {
        for (const [key, value] of Object.entries(data))
            this.stack.set(key as keyof T, value as T[keyof T]);
        return this;
    }

    get<K extends keyof T>(key: K): T[K] {
        return this.stack.get(key) as T[K];
    }

    set<K extends keyof T>(key: K, value: T[K]): this {
        this.stack.set(key, value);
        return this;
    }

    remove<K extends keyof T>(key: K): this {
        this.stack.delete(key);
        return this;
    }

    clear(): this {
        this.stack.clear();
        return this;
    }

    render(): T {
        return Object.fromEntries(this.stack) as any as T;
    }

    static stabilize<T>(json: string | T | null): T {
        return stabilizeJson<T>(json);
    }

    static from<T extends IParseableEntries>(data: T): Json<T> {
        const json = new Json<T>(null);
        json.records(data);
        return json;
    }

    static records<T extends IParseableEntries>(support: Json<T>, data: IParseablePrimitiveEntry<T>): Json<T> {
        return support.records(this.stabilize(data));
    }
}