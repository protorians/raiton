import fs from "fs";
import path from "path";
import tsconfig from "../../../tsconfig.json";

/**
 * Resolves the provided pathname to its corresponding alias path based on the configured TypeScript paths and output directories.
 *
 * @param {string} pathname - The input path to resolve as per the alias configurations in the TypeScript configuration.
 * @return {string | null} - The resolved alias path if it exists, or null if no matching alias is found.
 */
export function aliasPath(pathname: string): string | null {

    const paths = (tsconfig.compilerOptions as any)?.paths ?? {};
    const prefix = (process.env.RAITON_NATURAL_MODE) ? "" : (tsconfig.compilerOptions?.outDir ?? "dist");
    // pathname = pathname.replace(/^@\/?/, prefix ? prefix + "/" : "");

    const baseUrl = (tsconfig.compilerOptions as any)?.baseUrl ?? ".";

    for (const [aliasPattern, resolvedPaths] of Object.entries(paths)) {
        const aliasKey = aliasPattern.replace("/*", "");
        const aliasValue = path.join(prefix, (resolvedPaths as string[])[0]?.replace("/*", ""));

        if (pathname.startsWith(aliasKey)) {
            const relativePath = pathname.replace(aliasKey, aliasValue);
            const fullPath = path.resolve(baseUrl, relativePath);
            const extensions = [".ts", ".js"];

            for (const ext of extensions)
                if (fs.existsSync(fullPath + ext))
                    return fullPath + ext;

            if (fs.existsSync(path.join(fullPath, "index.ts")))
                return path.join(fullPath, "index.ts");

            if (fs.existsSync(path.join(fullPath, "index.js")))
                return path.join(fullPath, "index.js");

            if (fs.existsSync(path.join(fullPath, "index.mjs")))
                return path.join(fullPath, "index.mjs");

            if (fs.existsSync(path.join(fullPath, "index.cjs")))
                return path.join(fullPath, "index.cjs");

            return fullPath;
        }
    }

    return null;
}
