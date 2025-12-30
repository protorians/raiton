import {IGenericValueType} from "../../types";

export function getType(value: any): IGenericValueType {
    if (typeof value === "string") return "string";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "bigint") return "bigInt";
    if (typeof value === "number") {
        if (Number.isInteger(value)) return "int";
        return "float";
    }
    return (typeof value) as any;
}

export function stabilizeJson<T>(json: string | T | null) {
    if (!json) return {} as T;

    switch (typeof json) {
        case 'string':
            return JSON.parse(json);
        case 'object':
            return json as T;
        default:
            throw new Error('Invalid JSON format');
    }
}
