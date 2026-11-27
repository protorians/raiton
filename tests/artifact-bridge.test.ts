import "reflect-metadata";
import fs from "node:fs";
import path from "node:path";
import {afterEach, describe, expect, it} from "bun:test";
import {introspectProject} from "../source/manifest/introspect.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import {RaitonThread} from "../source/core/thread.ts";
import {Raiton} from "../source/core/raiton.ts";
import {Injection} from "../source/core/injection/injection.ts";
import {ArtifactRegistry} from "../source/core/bridge/registry.ts";
import {BridgeLoader} from "../source/core/bridge/loader.ts";
import {defineArtifactBridge} from "../source/core/bridge/definition.ts";
import {classifyConstruct, resolveArtifacts} from "../source/core/bridge/classifier.ts";
import {METADATA_KEYS} from "../source/framework/constants/decorators.constant.ts";
import {Controllable} from "../source/framework/decorators/controllable.decorator.ts";
import {Get} from "../source/framework/decorators/routable.decorator.ts";
import {Injectable} from "../source/framework/decorators/injection.decorator.ts";
import {validateConfig} from "../source/core/config/schema.ts";
import {catalogEntry} from "../source/framework/errors/catalog.ts";

const ROOT = path.resolve(import.meta.dir, "..");
const FRAMEWORK = path.join(ROOT, "source", "framework", "index.ts");
const CORE = path.join(ROOT, "source", "core", "index.ts");
const TYPES = path.join(ROOT, "source", "types", "index.ts");

const temporary: string[] = [];

function write(root: string, files: Record<string, string>) {
    for (const [name, content] of Object.entries(files)) {
        const filename = path.join(root, name);
        fs.mkdirSync(path.dirname(filename), {recursive: true});
        fs.writeFileSync(filename, content, "utf-8");
    }
}

function fixture(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "raiton-bridge-"));
    temporary.push(root);
    write(root, files);
    // Runtime dependencies imported by the fixture's entry point must resolve
    // from the temporary project, not from the framework repository.
    const modules = path.join(root, "node_modules");
    fs.mkdirSync(modules, {recursive: true});
    for (const name of ["reflect-metadata"]) {
        const source = path.join(ROOT, "node_modules", name);
        const target = path.join(modules, name);
        if (fs.existsSync(source) && !fs.existsSync(target)) {
            fs.symlinkSync(source, target, "dir");
        }
    }
    return root;
}

class MockReply {
    statusCode = 200;
    headers = new Headers();
    body: any;
    contentType = "";

    status(code: number) {
        this.statusCode = code;
    }

    header(name: string, value: string) {
        this.headers.set(name, value);
    }

    send(body: any) {
        this.body = body;
    }

    text(text: string) {
        this.body = text;
    }

    json(json: any) {
        this.body = json;
    }

    type(type: string) {
        this.contentType = type;
    }
}

async function request(app: any, method: string, url: string) {
    const reply = new MockReply();
    const input = {method, url, headers: new Headers()};
    await app.handle(input, reply);
    return reply;
}

function reset() {
    // Remove only the classes registered for this fixture. Clearing the whole
    // container would break other test files that share the Bun process.
    for (const record of ArtifactRegistry.records()) {
        const definition = Injection.definition(record.name);
        if (record.construct && definition?.construct === record.construct) {
            Injection.unregister(record.name);
        }
    }
    Injection.unregister("MetaService");
    delete (globalThis as any).__bridgeAudit;
    delete (globalThis as any).__bridgeMiddleware;
    RaitonConfig.reset();
    RaitonThread.reset();
    Raiton.resetThread();
    ArtifactRegistry.clear();
    void BridgeLoader.reset();
}

afterEach(() => {
    reset();
    for (const root of temporary.splice(0)) {
        fs.rmSync(root, {recursive: true, force: true});
    }
});

function bridgeProject(options: {packageField?: boolean; transitive?: boolean} = {}) {
    const packageArtifacts = options.packageField === false
        ? ""
        : `"raiton": {"artifacts": ["./dist/auto.controller.ts"]},`;

    const files: Record<string, string> = {
        "raiton.config.json": JSON.stringify({rootDir: "./source", version: "0.1.0", port: 5899}),
        "package.json": JSON.stringify({
            name: "fixture-project",
            dependencies: {"@fixture/users": "1.0.0"},
        }),
        "source/main.ts": `
import "reflect-metadata";
import {Application} from ${JSON.stringify(CORE)};
export default async (thread: any) => {
    const app = new Application({port: 5899});
    return await thread.setup({application: app}).run();
};
`,
        "source/controllers/local.controller.ts": `
import {Controllable, Get} from ${JSON.stringify(FRAMEWORK)};
@Controllable("/local")
export class LocalController {
    @Get("/") index() { return {local: true}; }
}
`,
        "source/legacy/handlers.ts": `
import {Controllable, Get} from ${JSON.stringify(FRAMEWORK)};
@Controllable("/legacy")
export class LegacyController {
    @Get("/") index() { return {legacy: true}; }
}
`,
        "source/artifacts.bridge.ts": `
import {defineArtifactBridge} from ${JSON.stringify(CORE)};
import {UsersService} from "@fixture/users";
import {AnalyticsController} from "@fixture/users/dist/analytics.ts";
import {AuthMiddleware} from "@fixture/users/dist/middleware.ts";

const audit = () => {
    const scope = globalThis as any;
    scope.__bridgeAudit = (scope.__bridgeAudit ?? 0) + 1;
};

export default defineArtifactBridge({
    artifacts: [
        UsersService,
        "@fixture/users",
        AnalyticsController,
        "./legacy/handlers.ts",
        {middleware: AuthMiddleware, name: "fixture-auth"},
        {hook: "onRequest", handler: audit, name: "fixture-audit"},
    ],
});
`,
        "node_modules/@fixture/users/package.json": JSON.stringify({
            name: "@fixture/users",
            version: "1.0.0",
            main: "./dist/index.ts",
            peerDependencies: {raiton: "^6"},
            ...(options.packageField === false ? {} : {raiton: {artifacts: ["./dist/auto.controller.ts"]}}),
            ...(options.transitive ? {dependencies: {"@fixture/nested": "1.0.0"}} : {}),
        }),
        "node_modules/@fixture/users/dist/index.ts": `
import {Controllable, Get, Injectable, Inject} from ${JSON.stringify(FRAMEWORK)};
@Injectable()
export class UsersService {
    name = "fixture-users";
}
@Controllable("/users")
export class UsersController {
    service: UsersService;
    constructor(@Inject(UsersService) service: UsersService) {
        this.service = service;
    }
    @Get("/") index() { return {name: this.service.name}; }
}
`,
        "node_modules/@fixture/users/dist/analytics.ts": `
import {Controllable, Get} from ${JSON.stringify(FRAMEWORK)};
@Controllable("/analytics")
export class AnalyticsController {
    @Get("/") index() { return {analytics: true}; }
}
`,
        "node_modules/@fixture/users/dist/auto.controller.ts": `
import {Controllable, Get} from ${JSON.stringify(FRAMEWORK)};
@Controllable("/auto")
export class AutoController {
    @Get("/") index() { return {auto: true}; }
}
`,
        "node_modules/@fixture/users/dist/middleware.ts": `
export async function AuthMiddleware({context, next}: any) {
    const scope = globalThis as any;
    scope.__bridgeMiddleware = (scope.__bridgeMiddleware ?? 0) + 1;
    context.state.fixtureAuth = true;
    await next();
}
`,
    };

    if (options.transitive) {
        files["node_modules/@fixture/users/node_modules/@fixture/nested/package.json"] = JSON.stringify({
            name: "@fixture/nested",
            version: "1.0.0",
            main: "./index.ts",
            raiton: {artifacts: ["./nested.controller.ts"]},
        });
        files["node_modules/@fixture/users/node_modules/@fixture/nested/index.ts"] = "export const nested = true;\n";
        files["node_modules/@fixture/users/node_modules/@fixture/nested/nested.controller.ts"] = `
import {Controllable, Get} from ${JSON.stringify(FRAMEWORK)};
@Controllable("/nested")
export class NestedController {
    @Get("/") index() { return {nested: true}; }
}
`;
    }

    return fixture(files);
}

describe("artifact bridge — API et classification", () => {
    it("normalise le manifeste avec defineArtifactBridge", () => {
        expect(defineArtifactBridge({artifacts: []})).toEqual({artifacts: []});
        expect(defineArtifactBridge([])).toEqual({artifacts: []});
        expect(() => defineArtifactBridge({} as any)).toThrow();
    });

    it("classifie par métadonnées et non par suffixe", () => {
        @Controllable("/meta")
        class MetaController {
            @Get("/") index() {
                return {};
            }
        }

        @Injectable()
        class MetaService {
        }

        expect(classifyConstruct(MetaController)?.kind).toBe("controller");
        expect(classifyConstruct(MetaService)?.kind).toBe("di");
        expect(classifyConstruct(class {
        })).toBeNull();
    });

    it("retourne tous les artefacts décorés d'un module", () => {
        class One {
        }

        class Two {
        }

        Reflect.defineMetadata(METADATA_KEYS.CONTROLLERS, {prefix: "/one", routes: []}, One.prototype);
        Reflect.defineMetadata(METADATA_KEYS.CONTAINER, {name: "Two", construct: Two, lifetime: 0}, Two);

        const artifacts = resolveArtifacts({One, Two, helper: () => undefined});
        expect(artifacts.map(artifact => artifact.name).sort()).toEqual(["One", "Two"]);
    });

    it("valide la configuration additive du bridge", () => {
        expect(validateConfig({
            rootDir: "./source",
            artifacts: {types: [], bridge: false, packages: false, packageAllowlist: ["@acme/users"]},
        }).valid).toBe(true);

        const invalid = validateConfig({
            rootDir: "./source",
            artifacts: {types: [], bridge: "", packages: "yes", packageAllowlist: [1]},
        });
        expect(invalid.valid).toBe(false);
        expect(invalid.errors.map(error => error.field)).toContain("artifacts.bridge");
        expect(invalid.errors.map(error => error.field)).toContain("artifacts.packages");
    });

    it("publie les codes bridge dans le catalogue d'erreurs stable", () => {
        const entry = catalogEntry("BRIDGE_MODULE_NOT_FOUND");
        expect(entry.code).toBe("BRIDGE_MODULE_NOT_FOUND");
        expect(entry.docsPath).toBe("user-guide/artifact-bridge.md");
        expect(entry.hint).toBeTruthy();
    });
});

describe("artifact bridge — intégration", () => {
    it("monte les artefacts de package, locaux et auto-descriptifs une seule fois", async () => {
        const root = bridgeProject();
        const {application, manifest, validation} = await introspectProject(root);

        expect(validation.valid).toBe(true);
        expect(manifest.bridge?.loaded).toBe(true);
        expect(manifest.bridge?.file).toBe("source/artifacts.bridge.ts");
        expect(manifest.bridge?.packages).toContain("@fixture/users");

        const routes = manifest.routes.map(route => `${route.method} ${route.path}`);
        expect(routes).toContain("GET /users/");
        expect(routes).toContain("GET /analytics/");
        expect(routes).toContain("GET /legacy/");
        expect(routes).toContain("GET /auto/");
        expect(routes).toContain("GET /local/");
        expect(routes.filter(route => route === "GET /users/")).toHaveLength(1);

        const users = manifest.routes.find(route => route.path === "/users/")!;
        expect(users.origin).toBe("bridge");
        expect(users.package).toBe("@fixture/users");
        expect(users.file).toContain("@fixture/users");

        const userResponse = await request(application, "GET", "/users/");
        expect(userResponse.statusCode).toBe(200);
        expect(userResponse.body).toEqual({name: "fixture-users"});

        const legacy = await request(application, "GET", "/legacy/");
        expect(legacy.body).toEqual({legacy: true});

        expect((globalThis as any).__bridgeMiddleware).toBeGreaterThan(0);
        expect((globalThis as any).__bridgeAudit).toBeGreaterThan(0);
    });

    it("découvre une dépendance directe auto-descriptive même sans fichier bridge", async () => {
        const root = bridgeProject();
        fs.rmSync(path.join(root, "source/artifacts.bridge.ts"));

        const {application, manifest, validation} = await introspectProject(root);

        expect(validation.valid).toBe(true);
        expect(manifest.bridge?.loaded).toBe(true);
        expect(manifest.bridge?.file).toBeNull();
        expect(manifest.routes.map(route => route.path)).toContain("/auto/");
        expect((await request(application, "GET", "/auto/")).body).toEqual({auto: true});
    });

    it("peut désactiver la découverte des packages auto-descriptifs", async () => {
        const root = bridgeProject();
        fs.rmSync(path.join(root, "source/artifacts.bridge.ts"));
        fs.writeFileSync(path.join(root, "raiton.config.json"), JSON.stringify({
            rootDir: "./source",
            version: "0.1.0",
            port: 5899,
            artifacts: {types: [], packages: false},
        }), "utf-8");

        const {manifest} = await introspectProject(root);
        expect(manifest.routes.map(route => route.path)).not.toContain("/auto/");
    });

    it("ne découvre pas les dépendances transitives auto-descriptives", async () => {
        const root = bridgeProject({transitive: true});
        const {application, manifest} = await introspectProject(root);

        expect(manifest.routes.map(route => route.path)).not.toContain("/nested/");
        const replied = await request(application, "GET", "/nested/");
        expect(replied.statusCode).toBe(404);
    });

    it("échoue avec un diagnostic actionnable pour un module introuvable", async () => {
        const root = fixture({
            "raiton.config.json": JSON.stringify({rootDir: "./source", version: "0.1.0"}),
            "package.json": JSON.stringify({name: "broken-bridge"}),
            "source/main.ts": `
import "reflect-metadata";
import {Application} from ${JSON.stringify(CORE)};
export default async (thread: any) => thread.setup({application: new Application({port: 5899})}).run();
`,
            "source/artifacts.bridge.ts": `
import {defineArtifactBridge} from ${JSON.stringify(CORE)};
export default defineArtifactBridge({artifacts: ["@missing/package"]});
`,
        });

        let error: any;
        try {
            await introspectProject(root);
        } catch (caught) {
            error = caught;
        }

        expect(error).toBeTruthy();
        expect(error.code).toBe("BRIDGE_MODULE_NOT_FOUND");
        expect(error.diagnostic.action).toBeTruthy();
        expect(error.diagnostic.docsUrl).toContain("artifact-bridge");
    });

    it("échoue avec un diagnostic actionnable pour un export de bridge invalide", async () => {
        const root = fixture({
            "raiton.config.json": JSON.stringify({rootDir: "./source", version: "0.1.0"}),
            "package.json": JSON.stringify({name: "invalid-export"}),
            "source/main.ts": `
import "reflect-metadata";
import {Application} from ${JSON.stringify(CORE)};
export default async (thread: any) => thread.setup({application: new Application({port: 5899})}).run();
`,
            "source/artifacts.bridge.ts": `export default {artifacts: "not-an-array"};\n`,
        });

        let error: any;
        try {
            await introspectProject(root);
        } catch (caught) {
            error = caught;
        }
        expect(error?.code).toBe("BRIDGE_FILE_INVALID_EXPORT");
        expect(error?.diagnostic?.action).toBeTruthy();
    });

    it("rejette un hook inconnu avec la liste des hooks supportés", async () => {
        const root = fixture({
            "raiton.config.json": JSON.stringify({rootDir: "./source", version: "0.1.0"}),
            "package.json": JSON.stringify({name: "invalid-hook"}),
            "source/main.ts": `
import "reflect-metadata";
import {Application} from ${JSON.stringify(CORE)};
export default async (thread: any) => thread.setup({application: new Application({port: 5899})}).run();
`,
            "source/artifacts.bridge.ts": `
import {defineArtifactBridge} from ${JSON.stringify(CORE)};
export default defineArtifactBridge({artifacts: [{hook: "onUnknown", handler: () => undefined}]});
`,
        });

        let error: any;
        try {
            await introspectProject(root);
        } catch (caught) {
            error = caught;
        }
        expect(error?.code).toBe("BRIDGE_HOOK_UNKNOWN");
        expect(error?.diagnostic?.action).toContain("onRequest");
    });

    it("recharge le bridge sans supprimer les routes du scan", async () => {
        const root = bridgeProject();
        const {application} = await introspectProject(root);

        expect((await request(application, "GET", "/legacy/")).statusCode).toBe(200);
        expect((await request(application, "GET", "/local/")).statusCode).toBe(200);

        fs.writeFileSync(path.join(root, "source/artifacts.bridge.ts"), `
import {defineArtifactBridge} from ${JSON.stringify(CORE)};
import {UsersController, UsersService} from "@fixture/users";
export default defineArtifactBridge({artifacts: [UsersService, UsersController]});
`, "utf-8");

        await BridgeLoader.reload({workdir: root, development: true});

        expect((await request(application, "GET", "/legacy/")).statusCode).toBe(404);
        expect((await request(application, "GET", "/local/")).statusCode).toBe(200);
        expect((await request(application, "GET", "/users/")).statusCode).toBe(200);

        delete (globalThis as any).__bridgeAudit;
        delete (globalThis as any).__bridgeMiddleware;
        await request(application, "GET", "/users/");
        expect((globalThis as any).__bridgeAudit ?? 0).toBe(0);
        expect((globalThis as any).__bridgeMiddleware ?? 0).toBe(0);
    });
});
