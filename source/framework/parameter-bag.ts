import {ParseableEntriesType, ParseablePrimitiveType} from "../types";
import {stabilizeJson} from "./utilities";
import {DynamicParameter, IDynamicParameters, IDynamicProps, IParameter,} from "@protorians/parameters";


export class ParameterBag<T extends ParseableEntriesType> {

    protected _bag: IDynamicParameters<any>;

    constructor(data: T) {
        this._bag = new DynamicParameter(this.initializeData(data));
    }

    protected initializeData(data: T): any {
        const prepared = {} as IDynamicProps<T>

        for (const [key, value] of Object.entries(data)) {
            prepared[key as keyof T] = {
                value,
            } as IParameter<T[keyof T]>
        }

        return prepared
    }

    get bag(): IDynamicParameters<any> {
        return this._bag;
    }

    records(data: T): this {
        for (const [key, value] of Object.entries(data))
            this._bag.update(key as keyof T, value);
        return this;
    }

    render(): T {
        return Object.fromEntries(this._bag.stack) as any as T;
    }

    toString(): string {
        return JSON.stringify(this.render());
    }

    static stabilize<T>(json: string | T | null): T {
        return stabilizeJson<T>(json);
    }

    static from<T extends IDynamicProps<T>>(data: T): ParameterBag<T> {
        return new ParameterBag<T>(data);
    }

    static records<T extends IDynamicProps<T>>(support: ParameterBag<T>, data: ParseablePrimitiveType<T>): ParameterBag<T> {
        return support.records(this.stabilize(data));
    }
}