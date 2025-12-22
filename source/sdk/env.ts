import {IGenericValue} from "../types/generic";
import {getType} from "./utilities";

export function env<T>(key: string, type?: IGenericValue): T | undefined {
    const value = process.env[key];
    type = type || getType(value) as IGenericValue;

    if (value) {
        switch (type) {

            case "bigInt":
                return BigInt(value) as any;

            case 'float':
                return parseFloat(value) as any;

            case 'boolean':
                return Boolean(value) as any;

            case "int":
                return parseInt(value) as any;

            default:
                return value as any;
        }
    }

    return undefined;
}

export function envGroup(key: string): Record<string, IGenericValue | undefined> {
    const filtered = Object.entries(process.env)
        .filter(([index]) => key.startsWith(index))
    const gen: Record<string, IGenericValue | undefined> = {}

    for (const [index, value] of filtered)
        gen[index] = env(value as any, undefined)

    return gen;
}