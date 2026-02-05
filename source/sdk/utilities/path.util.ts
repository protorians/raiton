import path from "node:path";
import { fileURLToPath } from "node:url";

export function getDirname(importMetaUrl: string): string {
    return path.dirname(fileURLToPath(importMetaUrl));
}

export function getFilename(importMetaUrl: string): string {
    return fileURLToPath(importMetaUrl);
}

export function getPackageRoot(importMetaUrl: string): string {
    const dirname = getDirname(importMetaUrl);
    // On remonte jusqu'à trouver un package.json ou on remonte d'un niveau si on est dans source/bin ou build/bin
    if (dirname.endsWith('bin')) {
        return path.join(dirname, '..');
    }
    return dirname;
}
