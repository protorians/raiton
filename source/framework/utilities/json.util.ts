import fs from "node:fs";

export function tryParseJson<T>(obj: any): T | null {
    try {
        return JSON.parse(obj);
    } catch (e) {
        return null;
    }
}


export class JsonUtil {
    static trying = tryParseJson;
    static parse = JSON.parse;
    static stringify = JSON.stringify;

    static import(pathname: string) {
        const json = fs.readFileSync(pathname, "utf-8");
        return JSON.parse(json);
    }
}