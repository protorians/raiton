import fs from "node:fs";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {RaitonConfig} from "../source/core/config/config.ts";
import {ConfigValidationError, getConfigJsonSchema, validateConfig} from "../source/core/config/schema.ts";
import {RaitonThread} from "../source/core/thread.ts";
import {defineConfigSync} from "../source/core/config/define.ts";
import {Application} from "../source/core/application.ts";
import {Raiton} from "../source/core/raiton.ts";

const roots: string[] = [];

function fixture(files: Record<string, string>): string {
    const directory = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "raiton-config-"));
    roots.push(directory);
    for (const [name, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(directory, name), content, "utf-8");
    }
    return directory;
}

describe("configuration", () => {
    beforeEach(() => RaitonConfig.reset());
    afterEach(() => {
        RaitonConfig.reset();
        for (const root of roots.splice(0)) {
            fs.rmSync(root, {recursive: true, force: true});
        }
    });

    it("charge raiton.config.ts avant les autres formats", async () => {
        const root = fixture({
            "raiton.config.ts": `export default {rootDir: "./src", version: "2.0.0", port: 5800}\n`,
            "raiton.config.json": JSON.stringify({rootDir: "./json", version: "1.0.0", port: 5801}),
        });

        await RaitonConfig.sync(root, {force: true});

        expect(RaitonConfig.get("rootDir")).toBe("./src");
        expect(RaitonConfig.get("version")).toBe("2.0.0");
        expect(RaitonConfig.get("port")).toBe(5800);
        expect(RaitonConfig.source?.endsWith("raiton.config.ts")).toBe(true);
    });

    it("charge raiton.config.json en repli", async () => {
        const root = fixture({
            "raiton.config.json": JSON.stringify({rootDir: "./source", version: "1.0.0", port: 5701}),
        });

        await RaitonConfig.sync(root, {force: true});
        expect(RaitonConfig.get("port")).toBe(5701);
        expect(RaitonConfig.errors).toHaveLength(0);
    });

    it("produit des erreurs par champ et bloque la validation", async () => {
        const root = fixture({
            "raiton.config.json": JSON.stringify({rootDir: "./source", version: "1.0.0", port: 99999}),
        });

        await RaitonConfig.sync(root, {force: true});

        expect(RaitonConfig.errors.some(error => error.field === "port")).toBe(true);
        expect(() => RaitonConfig.assertValid()).toThrow(ConfigValidationError);
    });

    it("valide les champs imbriqués", () => {
        const result = validateConfig({
            rootDir: "./source",
            version: "1.0.0",
            observability: {mode: "invalid"},
            shutdown: {timeoutMs: -1},
            mcp: {rateLimitPerMinute: 1.5},
        });

        expect(result.valid).toBe(false);
        expect(result.errors.map(error => error.field)).toContain("observability.mode");
        expect(result.errors.map(error => error.field)).toContain("shutdown.timeoutMs");
        expect(result.errors.map(error => error.field)).toContain("mcp.rateLimitPerMinute");
    });

    it("valide la configuration à la définition", () => {
        expect(() => defineConfigSync({rootDir: "./source", port: 99999})).toThrow(ConfigValidationError);
        const config = defineConfigSync({rootDir: "./source", port: 5702});
        expect(config.port).toBe(5702);
    });

    it("empêche l'écoute avec une configuration d'application invalide", async () => {
        RaitonThread.reset();
        Raiton.resetThread();
        const thread = new RaitonThread({
            workdir: process.cwd(),
            options: {serve: false},
            prepare: async () => thread,
            boot: async () => undefined,
        } as any, {serve: false});
        thread.application = new Application({port: 99999});
        (thread as any).runtime = {};

        await expect(thread.run()).rejects.toBeInstanceOf(ConfigValidationError);
    });

    it("publie un schéma JSON de configuration", () => {
        const schema = getConfigJsonSchema();
        expect(schema.$schema).toContain("json-schema");
        expect(schema.properties.port.maximum).toBe(65535);
        expect(schema.properties.observability.properties.mode.enum).toContain("all");
    });
});
