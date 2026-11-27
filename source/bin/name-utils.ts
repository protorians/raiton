export function kebab(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "app";
}

export function pascal(value: string): string {
    return kebab(value)
        .split("-")
        .filter(Boolean)
        .map(part => part[0].toUpperCase() + part.slice(1))
        .join("") || "App";
}

export function camel(value: string): string {
    const result = pascal(value);
    return result ? result[0].toLowerCase() + result.slice(1) : "app";
}

export function plural(value: string): string {
    if (/s$/i.test(value)) return value;
    if (/[^aeiou]y$/i.test(value)) return `${value.slice(0, -1)}ies`;
    return `${value}s`;
}
