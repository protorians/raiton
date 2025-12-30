export function tryParseJson<T>(obj: any): T | null {
    try {
        return JSON.parse(obj);
    } catch (e) {
        return null;
    }
}