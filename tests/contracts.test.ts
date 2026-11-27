import "reflect-metadata";
import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {Application} from "../source/core/application.ts";
import {compileController} from "../source/core/controller/compiler.ts";
import {Injection} from "../source/core/injection/injection.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import {RaitonThread} from "../source/core/thread.ts";
import {Raiton} from "../source/core/raiton.ts";
import {Body, Controllable, Get, Post} from "../source/framework/decorators/index.ts";
import {Input, Output, t} from "../source/contracts/index.ts";
import {validateContract} from "../source/contracts/schema.ts";
import {generateOpenApiSpec} from "../source/framework/utilities/openapi.utils.ts";

const CreateItem = t.object({
    name: t.string().min(2),
    email: t.string().email().optional(),
});

const Item = t.object({
    id: t.integer(),
    name: t.string(),
});

let handlerCalls = 0;

@Controllable("/items")
class ItemsController {
    @Get("/")
    @Output(t.object({ok: t.boolean()}))
    list() {
        return {ok: true};
    }

    @Post("/")
    @Input(CreateItem)
    @Output(Item)
    create(@Body() input: {name: string}) {
        handlerCalls += 1;
        return {id: 1, name: input.name};
    }
}

@Controllable("/broken")
class BrokenController {
    @Get("/")
    @Output(Item)
    list() {
        return {id: "not-an-integer", name: "broken"};
    }
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

function request(method: string, url: string, body?: any) {
    const reply = new MockReply();
    const headers = new Headers();
    if (body !== undefined) headers.set("content-type", "application/json");
    return {
        reply,
        input: {method, url, headers, body},
    };
}

async function buildApp(): Promise<Application> {
    RaitonConfig.reset();
    RaitonThread.reset();
    Raiton.resetThread();
    const app = new Application({port: 5711, prefix: "/api"});
    compileController(ItemsController, app);
    compileController(BrokenController, app);
    return app;
}

describe("contrats schema-first", () => {
    beforeEach(() => {
        handlerCalls = 0;
        process.env.NODE_ENV = "test";
    });

    afterEach(() => {
        process.env.NODE_ENV = "test";
    });

    it("valide une charge valide et exécute le handler", async () => {
        const app = await buildApp();
        const {input, reply} = request("POST", "/api/items", {name: "Raiton"});

        await app.handle(input, reply);

        expect(reply.statusCode).toBe(200);
        expect(reply.body).toEqual({id: 1, name: "Raiton"});
        expect(handlerCalls).toBe(1);
    });

    it("rejette une charge invalide avant le handler avec un format stable", async () => {
        const app = await buildApp();
        const {input, reply} = request("POST", "/api/items", {name: "x", email: "nope"});

        await app.handle(input, reply);

        expect(handlerCalls).toBe(0);
        expect(reply.statusCode).toBe(400);
        expect(reply.body.code).toBe("VALIDATION_ERROR");
        expect(reply.body.error).toBe(true);
        expect(reply.body.details.map((issue: any) => issue.path)).toContain("name");
        expect(reply.body.details.map((issue: any) => issue.path)).toContain("email");
        expect(reply.body.docsUrl).toContain("docs");
    });

    it("signale une sortie invalide en développement", async () => {
        process.env.NODE_ENV = "development";
        const app = await buildApp();
        const {input, reply} = request("GET", "/api/broken");

        await app.handle(input, reply);

        expect(reply.statusCode).toBe(500);
        expect(reply.body.code).toBe("OUTPUT_VALIDATION_ERROR");
        expect(reply.body.message).toContain("GET /broken/");
        expect(Array.isArray(reply.body.details)).toBe(true);
    });

    it("désactive la validation de sortie hors développement", async () => {
        process.env.NODE_ENV = "production";
        const app = await buildApp();
        const {input, reply} = request("GET", "/api/broken");

        await app.handle(input, reply);

        expect(reply.statusCode).toBe(200);
        expect(reply.body).toEqual({id: "not-an-integer", name: "broken"});
    });

    it("dérive l'OpenAPI des mêmes schémas", async () => {
        const app = await buildApp();
        const spec = await generateOpenApiSpec((app as any).root, {
            title: "Items",
            version: "1.0.0",
            description: "",
        });

        const operation = spec.paths["/items/"].post;
        expect(operation.requestBody.content["application/json"].schema.properties.name.minLength).toBe(2);
        expect(operation.responses["200"].content["application/json"].schema.properties.id.type).toBe("integer");
    });

    it("accepte des schémas JSON simples (MCP / baselines)", async () => {
        const result = await validateContract({
            type: "object",
            properties: {a: {type: "number"}, b: {type: "number"}},
            required: ["a", "b"],
        }, {a: 1, b: 2});
        expect(result.success).toBe(true);
    });
});
