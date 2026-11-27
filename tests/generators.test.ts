import fs from "node:fs";
import path from "node:path";
import {afterAll, describe, expect, it} from "bun:test";
import {projectFiles} from "../source/generators/project.templates.ts";
import {artifactFiles} from "../source/generators/artifact.templates.ts";
import {writeFiles} from "../source/bin/file-utils.ts";
import {CliError} from "../source/bin/cli-output.ts";
import {kebab, pascal, plural} from "../source/bin/name-utils.ts";

const roots: string[] = [];

function tempDir(): string {
    const directory = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "raiton-gen-"));
    roots.push(directory);
    return directory;
}

function assertTranspiles(files: Array<{path: string; content: string}>) {
    const transpiler = new Bun.Transpiler({loader: "ts"});
    for (const file of files) {
        if (!file.path.endsWith(".ts") && !file.path.endsWith(".mts")) continue;
        expect(() => transpiler.transformSync(file.content)).not.toThrow();
    }
}

describe("générateurs", () => {
    afterAll(() => {
        for (const root of roots.splice(0)) {
            fs.rmSync(root, {recursive: true, force: true});
        }
    });

    it("produit un projet API complet et syntaxiquement valide", () => {
        const files = projectFiles({name: "demo-api", template: "api", runtime: "bun"});
        const paths = files.map(file => file.path);

        expect(paths).toContain("package.json");
        expect(paths).toContain("tsconfig.json");
        expect(paths).toContain("raiton.config.ts");
        expect(paths).toContain("source/main.ts");
        expect(paths).toContain("source/controllers/demo-api.controller.ts");
        expect(paths).toContain("tests/demo-api.test.ts");
        expect(paths).toContain(".env.example");
        expect(paths).toContain("README.md");

        assertTranspiles(files);
    });

    it("produit les modèles minimal et mcp-agent", () => {
        const minimal = projectFiles({name: "minimal", template: "minimal", runtime: "node"});
        expect(minimal.map(file => file.path)).toContain("raiton.config.js");
        expect(minimal.map(file => file.path)).not.toContain("source/controllers/minimal.controller.ts");
        assertTranspiles(minimal);

        const mcp = projectFiles({name: "agent", template: "mcp-agent", runtime: "bun"});
        expect(mcp.map(file => file.path)).toContain("source/mcp/agent.mcp.ts");
        const test = mcp.find(file => file.path === "tests/agent.test.ts")!;
        expect(test.content).toContain("AgentMcpServer");
        assertTranspiles(mcp);
    });

    it("produit une ressource complète avec des imports cohérents", () => {
        const files = artifactFiles("resource", "users");
        const paths = files.map(file => file.path);

        expect(paths).toEqual([
            "source/dtos/users.dto.ts",
            "source/repositories/users.repository.ts",
            "source/services/users.service.ts",
            "source/controllers/users.controller.ts",
            "tests/users.test.ts",
        ]);

        const controller = files.find(file => file.path.endsWith(".controller.ts"))!;
        expect(controller.content).toContain('import {CreateUsers} from "../dtos/users.dto"');
        expect(controller.content).toContain('from "../services/users.service"');
        expect(controller.content).not.toContain('import type {CreateUsers}');

        const service = files.find(file => file.path.endsWith(".service.ts"))!;
        expect(service.content).toContain('from "../dtos/users.dto"');
        expect(service.content).toContain('from "../repositories/users.repository"');

        assertTranspiles(files);
    });

    it("refuse d'écraser sans --force et respecte --dry-run", () => {
        const root = tempDir();
        const files = [{path: "source/main.ts", content: "export default 1\n"}];

        const dry = writeFiles(root, files, {dryRun: true});
        expect(dry.written).toHaveLength(0);
        expect(fs.existsSync(path.join(root, "source/main.ts"))).toBe(false);

        writeFiles(root, files);
        expect(() => writeFiles(root, files)).toThrow(CliError);
        try {
            writeFiles(root, files);
        } catch (error: any) {
            expect(error.code).toBe("FILE_CONFLICT");
            expect(error.exitCode).toBe(3);
        }

        writeFiles(root, [{path: "source/main.ts", content: "export default 2\n"}], {force: true});
        expect(fs.readFileSync(path.join(root, "source/main.ts"), "utf-8")).toContain("2");
    });

    it("normalise les noms", () => {
        expect(kebab("CreateUser")).toBe("create-user");
        expect(pascal("create-user")).toBe("CreateUser");
        expect(plural("category")).toBe("categories");
    });
});
