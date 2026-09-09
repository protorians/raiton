export const isBunUsed = typeof (globalThis as any).Bun !== "undefined";
export const isDenoUsed = typeof (globalThis as any).Deno !== "undefined";
export const isNodeUsed = !isBunUsed && !isDenoUsed;

declare const Bun: any;
declare const Deno: any;
