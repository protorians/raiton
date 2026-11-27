import "reflect-metadata";
import {beforeEach, describe, expect, it} from "bun:test";
import {Application} from "../source/core/application.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import {openApiPlugin} from "../source/framework/plugins/openapi.plugin.ts";
import {RaitonResponses} from "../source/framework/responses/helpers.ts";
import {HttpStatus} from "../source/framework/enums/index.ts";

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

function request(url: string) {
    return {
        reply: new MockReply(),
        input: {method: "GET", url, headers: new Headers()},
    };
}

describe("découvrabilité", () => {
    beforeEach(() => RaitonConfig.reset());

    it("monte la page de développement uniquement en développement", async () => {
        const dev = new Application({port: 5711, develop: true});
        dev.get("/ping", () => ({ok: true}));

        const page = request("/__dev");
        await dev.handle(page.input, page.reply);
        expect(page.reply.statusCode).toBe(200);
        expect(page.reply.contentType).toContain("text/html");
        expect(String(page.reply.body)).toContain("Raiton development");
        expect(String(page.reply.body)).toContain("Copy manifest");

        const manifest = request("/__dev/manifest");
        await dev.handle(manifest.input, manifest.reply);
        expect(manifest.reply.statusCode).toBe(200);
        expect(manifest.reply.body.schemaVersion).toBe("1.0.0");

        const prod = new Application({port: 5711});
        const missing = request("/__dev");
        await prod.handle(missing.input, missing.reply);
        expect(missing.reply.statusCode).toBe(404);
    });

    it("suggère la route la plus proche en développement", async () => {
        const app = new Application({port: 5711, develop: true});
        app.get("/users/:id", () => ({ok: true}));

        const {input, reply} = request("/users/7");
        await app.handle(input, reply);

        // `/users/7` does not match `/:id`? It does; use a really unknown path.
        const unknown = request("/user/7");
        await app.handle(unknown.input, unknown.reply);
        expect(unknown.reply.statusCode).toBe(404);
        expect(unknown.reply.body.code).toBe("NOT_FOUND");
        expect(unknown.reply.body.suggestion).toContain("GET /users/:id");
    });

    it("fournit une UI OpenAPI par défaut et un endpoint JSON", async () => {
        const app = new Application({port: 5711});
        app.register(openApiPlugin({route: "/docs", endpoint: "/docs/json", title: "Demo"}));
        app.get("/items", () => ({ok: true}));

        const ui = request("/docs");
        await app.handle(ui.input, ui.reply);
        expect(ui.reply.statusCode).toBe(200);
        expect(String(ui.reply.body)).toContain("redoc");
        expect(String(ui.reply.body)).toContain('spec-url="docs/json"');

        const spec = request("/docs/json");
        await app.handle(spec.input, spec.reply);
        expect(spec.reply.statusCode).toBe(200);
        expect(spec.reply.body.openapi).toBe("3.0.0");
        expect(spec.reply.body.info.title).toBe("Demo");
    });

    it("enrichit une erreur legacy avec le catalogue stable", async () => {
        const app = new Application({port: 5711});
        app.get("/legacy", () => RaitonResponses("Nope", null, HttpStatus.NOT_FOUND, {error: true}));

        const {input, reply} = request("/legacy");
        await app.handle(input, reply);

        expect(reply.statusCode).toBe(404);
        expect(reply.body.code).toBe("NOT_FOUND");
        expect(reply.body.docsUrl).toContain("docs");
        expect(reply.body.requestId).toBeTruthy();
    });

    it("peut désactiver explicitement la page de développement", async () => {
        RaitonConfig.current.set("devPage", {enabled: false});
        const app = new Application({port: 5711, develop: true});
        const page = request("/__dev");
        await app.handle(page.input, page.reply);
        expect(page.reply.statusCode).toBe(404);
    });
});
