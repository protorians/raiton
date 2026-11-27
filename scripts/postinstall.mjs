#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(root, "source", "bin", "index.ts");

try {
    if (process.platform !== "win32" && fs.existsSync(bin)) {
        fs.chmodSync(bin, 0o755);
    }
} catch (error) {
    console.error("Raiton CLI: unable to set executable permission", error?.message ?? error);
}
