import {GenericValueType} from "../types/generic";
import {getType} from "./utilities";

export function env<T>(key: string, defaultValue?: T, type?: GenericValueType): T | undefined {
    const value = process.env[key] || defaultValue;
    type = type || getType(value) as GenericValueType;

    if (value) {
        switch (type) {

            case "bigInt":
                return BigInt(value.toString()) as any;

            case 'float':
                return parseFloat(value.toString()) as any;

            case 'boolean':
                return Boolean(value) as any;

            case "int":
                return parseInt(value.toString()) as any;

            default:
                return value as any;
        }
    }

    return undefined;
}

export function envGroup(key: string): Record<string, GenericValueType | undefined> {
    const filtered = Object.entries(process.env)
        .filter(([index]) => key.startsWith(index))
    const gen: Record<string, GenericValueType | undefined> = {}

    for (const [index, value] of filtered)
        gen[index] = env(value as any, undefined)

    return gen;
}