import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import {afterAll, describe, expect, it} from "bun:test";
import {introspectProject} from "../source/manifest/introspect.ts";
import {invalidateManifest, manifestCache} from "../source/manifest/manifest.ts";
import {validateManifest} from "../source/manifest/schema.ts";
import {checkContracts} from "../source/manifest/contract.ts";
import {generateClient} from "../source/manifest/client.ts";

const FIXTURE = path.join(import.meta.dir, "fixtures", "project");

describe("manifeste de projet", () => {
    afterAll(() => {
        fs.rmSync(path.join(FIXTURE, ".raiton"), {recursive: true, force: true});
        fs.rmSync(path.join(FIXTURE, "docs"), {recursive: true, force: true});
    });

    it("génère un manifeste versionné, validé et complet", async () => {
        invalidateManifest();
        const {manifest, validation} = await introspectProject(FIXTURE);

        expect(validation.valid).toBe(true);
        expect(manifest.schemaVersion).toBe("1.0.0");
        expect(manifest.framework.name).toBe("raiton");
        expect(manifest.project.entry).toBe("source/main.ts");

        const routes = manifest.routes.map(route => `${route.method} ${route.path}`);
        expect(routes).toContain("GET /items/:id");
        expect(routes).toContain("POST /items/");

        const getRoute = manifest.routes.find(route => route.path === "/items/:id")!;
        expect(getRoute.controller).toBe("ItemsController");
        expect(getRoute.file).toContain("items.controller.ts");
        expect(getRoute.line).toBeGreaterThan(0);
        expect(getRoute.outputSchema?.properties?.id?.type).toBe("integer");

        expect(manifest.artifacts).toContain("controller");
        expect(manifest.artifacts).toContain("mcp");
        expect(manifest.injection).toHaveProperty("ItemsController");

        const math = manifest.mcp.find(server => server.server === "math")!;
        expect(math.tools.find(tool => tool.name === "add")?.exposed).toBe(true);
        expect(math.tools.find(tool => tool.name === "drop")?.exposed).toBe(false);
    });

    it("invalide le cache à la demande", async () => {
        invalidateManifest();
        expect(manifestCache().cached).toBe(false);
    });

    it("détecte une rupture de contrat avec la route et le champ", async () => {
        const {manifest} = await introspectProject(FIXTURE);
        const baseline = JSON.parse(JSON.stringify(manifest));
        const post = baseline.routes.find((route: any) => route.method === "POST");
        post.outputSchema.properties.removed = {type: "string"};
        post.outputSchema.required = [...post.outputSchema.required, "removed"];

        const result = checkContracts(manifest, baseline);
        expect(result.compatible).toBe(false);
        expect(result.breaking.some(change =>
            change.route === "POST /items/" && change.field === "removed"
        )).toBe(true);

        const removedRoute = checkContracts(manifest, {
            ...baseline,
            routes: [...baseline.routes, {
                method: "GET",
                path: "/removed",
                controller: "Gone",
                handler: "gone",
                file: "",
                line: 0,
            }],
        });
        expect(removedRoute.breaking.some(change => change.kind === "route-removed")).toBe(true);
    });

    it("compare aussi une baseline OpenAPI", async () => {
        const {manifest} = await introspectProject(FIXTURE);
        const baseline = {
            openapi: "3.0.0",
            paths: {
                "/items/": {
                    post: {
                        requestBody: {
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {name: {type: "string"}, removed: {type: "string"}},
                                        required: ["name", "removed"],
                                    },
                                },
                            },
                        },
                        responses: {"200": {content: {"application/json": {schema: {type: "object"}}}}},
                    },
                },
            },
        };

        const result = checkContracts(manifest, baseline);
        expect(result.compatible).toBe(false);
        expect(result.breaking.some(change => change.field === "removed")).toBe(true);
    });

    it("génère un client typé sans any", async () => {
        const {manifest} = await introspectProject(FIXTURE);
        const client = generateClient(manifest, {name: "FixtureClient"});

        expect(client.includes("any")).toBe(false);
        expect(client.includes("export interface")).toBe(true);
        expect(client.includes("configureClient")).toBe(true);
        expect(client.includes("postItems")).toBe(true);

        // The generated client must be valid TypeScript.
        const transpiled = new Bun.Transpiler({loader: "ts"}).transformSync(client);
        expect(transpiled.length).toBeGreaterThan(0);
    });

    it("valide le schéma publié", () => {
        expect(validateManifest({schemaVersion: "1.0.0"}).valid).toBe(false);
    });
});
