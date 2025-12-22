

export type IParseableEntry = string | number | boolean | null | undefined | IParseableEntry[] | object;

export type IParseableEntries = Record<string, IParseableEntry>;

export type IParseablePrimitiveEntry<T extends IParseableEntries> = string | T | null;
