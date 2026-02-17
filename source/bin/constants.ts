export const isBunUsed = typeof (globalThis as any).Bun !== "undefined";
export const isDenoUsed = typeof (globalThis as any).Deno !== "undefined";

declare const Bun: any;
declare const Deno: any;
