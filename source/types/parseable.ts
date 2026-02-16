

export type ParseableType = string | number | boolean | null | undefined | ParseableType[] | object;

export type ParseableEntriesType = Record<string, ParseableType>;

export type ParseablePrimitiveType<T extends ParseableEntriesType> = string | T | null;
