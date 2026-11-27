import "reflect-metadata";
import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {spawnSync} from "node:child_process";
import {IsInt, IsString} from "class-validator";
import {Application} from "../source/core/application.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import {compileController} from "../source/core/controller/compiler.ts";
import {ControllerBuilder} from "../source/core/controller/builder.ts";
import {RaitonThread} from "../source/core/thread.ts";
import {Injection} from "../source/core/injection/injection.ts";
import {Router} from "../source/core/router/router.ts";
import {RouteMatcher} from "../source/core/router/matcher.ts";
import {Route} from "../source/core/router/route.ts";
import {MiddlewarePipeline} from "../source/core/middleware/pipeline.ts";
import {HookStore} from "../source/core/hooks.ts";
import {Artifacts} from "../source/framework/artifacts.ts";
import {CacheManager} from "../source/framework/cache/cache.ts";
import {bodyParserPlugin} from "../source/framework/plugins/body-parser.plugin.ts";
import {NodeRequest} from "../source/framework/runtime/node/request.ts";
import {ApiOkResponse} from "../source/framework/decorators/api-response.decorator.ts";
import {Cache} from "../source/framework/cache/cache.decorator.ts";
import {Controllable} from "../source/framework/decorators/controllable.decorator.ts";
import {Get, Post} from "../source/framework/decorators/routable.decorator.ts";
import {Body} from "../source/framework/decorators/parametrable.decorator.ts";

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

function request(method: string, url: string, body?: any, headers: Record<string, string> = {}) {
    return {
        reply: new MockReply(),
        input: {method, url, headers: new Headers(headers), body},
    };
}

const previousNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
    RaitonConfig.reset();
    CacheManager.clear();
});

afterEach(() => {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    RaitonConfig.reset();
    CacheManager.clear();
});

describe("routeur indexé", () => {
    it("résout la même route cible quelle que soit sa position d'enregistrement", () => {
        const count = 300;
        const first = new Router();
        first.add("GET" as any, "/health", () => ({ok: true}));
        for (let index = 0; index < count; index++) {
            first.add("GET" as any, `/resource-${index}/:id`, () => ({ok: true}));
        }

        const last = new Router();
        for (let index = 0; index < count; index++) {
            last.add("GET" as any, `/resource-${index}/:id`, () => ({ok: true}));
        }
        last.add("GET" as any, "/health", () => ({ok: true}));

        expect(first.resolve("GET", "/health")?.route.path).toBe("/health");
        expect(last.resolve("GET", "/health")?.route.path).toBe("/health");
    });

    it("extrait les paramètres dans un objet par requête sans muter la route", () => {
        const router = new Router();
        const route = router.add("GET" as any, "/users/:id", () => null);

        const one = router.resolve("GET", "/users/1");
        const two = router.resolve("GET", "/users/2");

        expect(one?.params).toEqual({id: "1"});
        expect(two?.params).toEqual({id: "2"});
        expect(one?.params).not.toBe(two?.params);
        expect(route.parameters).toEqual({});
    });

    it("résout les routes profondes et privilégie le chemin le plus spécifique", () => {
        const router = new Router();
        router.add("GET" as any, "/a/:b/c/:d", () => null);
        router.add("GET" as any, "/a/static/c/:d", () => null);

        expect(router.resolve("GET", "/a/static/c/42")?.params).toEqual({d: "42"});
        expect(router.resolve("GET", "/a/value/c/x")?.params).toEqual({b: "value", d: "x"});
        expect(router.resolve("GET", "/a/value/c/x/y")).toBeNull();
    });

    it("maintient les index lors des ajouts, remplacements et suppressions", () => {
        const matcher = new RouteMatcher();
        const route = new Route({
            method: "GET" as any,
            path: "/items/:id",
            handler: () => "old",
        });

        matcher.add(route);
        expect(matcher.resolve("GET", "/items/7")?.route).toBe(route);
        expect(matcher.routes.size).toBe(1);

        const replacement = new Route({
            method: "GET" as any,
            path: "/items/:id",
            handler: () => "new",
        });
        matcher.replace(replacement);
        expect(matcher.routes.size).toBe(1);
        expect(matcher.resolve("GET", "/items/7")?.route).toBe(replacement);

        matcher.remove(replacement);
        expect(matcher.routes.size).toBe(0);
        expect(matcher.resolve("GET", "/items/7")).toBeNull();

        matcher.add(route);
        matcher.clear();
        expect(matcher.routes.size).toBe(0);
        expect(matcher.resolve("GET", "/items/7")).toBeNull();
    });

    it("isole les paramètres de deux requêtes concurrentes", async () => {
        const app = new Application({port: 5711});
        app.get("/users/:id", async (ctx: any) => {
            await new Promise(resolve => setTimeout(resolve, ctx.params.id === "1" ? 5 : 1));
            return {id: ctx.params.id};
        });

        const first = request("GET", "/users/1");
        const second = request("GET", "/users/2");

        await Promise.all([
            app.handle(first.input, first.reply),
            app.handle(second.input, second.reply),
        ]);

        expect(first.reply.body).toEqual({id: "1"});
        expect(second.reply.body).toEqual({id: "2"});
    });

    it("répond 405 avec la méthode autorisée quand le chemin existe", async () => {
        const app = new Application({port: 5711});
        app.get("/only-get", () => ({ok: true}));

        const {input, reply} = request("POST", "/only-get");
        await app.handle(input, reply);

        expect(reply.statusCode).toBe(405);
        expect(reply.body.allowed).toEqual(["GET"]);
    });
});

describe("validation de réponse", () => {
    class ItemDto {
        @IsString()
        name!: string;

        @IsInt()
        count!: number;
    }

    @Controllable("/validated")
    class ValidatedController {
        @Get("/")
        @ApiOkResponse("item", ItemDto)
        item() {
            return {name: "ok", count: 1};
        }

        @Get("/invalid")
        @ApiOkResponse("item", ItemDto)
        invalid() {
            return {name: "ok", count: "not-an-integer"};
        }
    }

    it("désactive la validation en production et conserve la réponse d'origine", async () => {
        process.env.NODE_ENV = "production";
        const app = new Application({port: 5711});
        compileController(ValidatedController, app);

        const {input, reply} = request("GET", "/validated/invalid");
        await app.handle(input, reply);

        expect(reply.statusCode).toBe(200);
        expect(reply.body).toEqual({name: "ok", count: "not-an-integer"});
    });

    it("conserve la validation active en développement", async () => {
        process.env.NODE_ENV = "development";
        const app = new Application({port: 5711});
        compileController(ValidatedController, app);

        const {input, reply} = request("GET", "/validated/invalid");
        await app.handle(input, reply);

        expect(reply.statusCode).toBe(500);
    });

    it("accepte une réponse valide", async () => {
        process.env.NODE_ENV = "development";
        const app = new Application({port: 5711});
        compileController(ValidatedController, app);

        const {input, reply} = request("GET", "/validated");
        await app.handle(input, reply);

        expect(reply.statusCode).toBe(200);
        expect(reply.body).toEqual({name: "ok", count: 1});
    });
});

describe("body parser", () => {
    @Controllable("/echo")
    class EchoController {
        @Post("/")
        echo(@Body() body: any) {
            return body;
        }
    }

    it("parse un corps JSON depuis un ReadableStream et expose la query", async () => {
        const app = new Application({port: 5711});
        compileController(EchoController, app);

        const payload = {message: "x".repeat(520)};
        const raw = JSON.stringify(payload);
        const stream = new Blob([raw]).stream()

        const {input, reply} = request(
            "POST",
            "/echo?name=raiton",
            stream,
            {"content-type": "application/json"},
        );
        await app.handle(input, reply);

        expect(reply.statusCode).toBe(200);
        expect(reply.body).toEqual(payload);
        expect((input as any).query).toEqual({name: "raiton"});
    });

    it("n'installe le parser qu'une seule fois", () => {
        const app = new Application({port: 5711});
        const stack = (app as any).root.middleware.stack as any[]
        const size = stack.length

        app.use(bodyParserPlugin())
        app.register(bodyParserPlugin())

        expect(stack.length).toBe(size)
    });
});

describe("en-têtes Node", () => {
    it("memoïse les en-têtes pour une même requête", () => {
        const req: any = new NodeRequest({
            method: "GET",
            url: "/",
            headers: {"content-type": "application/json", cookie: "a=1"},
            socket: {remoteAddress: "127.0.0.1"},
        } as any)

        const headers = req.headers
        expect(req.headers).toBe(headers)
        expect(headers.get("content-type")).toBe("application/json")
    })
})

describe("invalidation HMR", () => {
    let calls = 0

    @Controllable("/cached")
    class CachedController {
        @Get("/")
        @Cache({ttl: 60_000})
        value() {
            calls += 1
            return {calls}
        }
    }

    @Controllable("/reloaded")
    class ReloadedController {
        @Get("/a")
        a() {
            return "a"
        }

        @Get("/b")
        b() {
            return "b"
        }

        @Get("/c")
        c() {
            return "c"
        }
    }

    it("invalide le cache d'une route recompilée", async () => {
        calls = 0
        const app = new Application({port: 5711})
        compileController(CachedController, app)

        const first = request("GET", "/cached");
        await app.handle(first.input, first.reply);
        expect(first.reply.body).toEqual({calls: 1});

        const cached = request("GET", "/cached");
        await app.handle(cached.input, cached.reply);
        expect(cached.reply.body).toEqual({calls: 1});

        compileController(CachedController, app)

        const afterReload = request("GET", "/cached");
        await app.handle(afterReload.input, afterReload.reply);
        expect(afterReload.reply.body).toEqual({calls: 2});
    });

    it("supprime les anciennes routes quand un contrôleur est renommé", async () => {
        @Controllable("/before-rename")
        class BeforeRenameController {
            @Get("/")
            value() {
                return "before"
            }
        }

        @Controllable("/after-rename")
        class AfterRenameController {
            @Get("/")
            value() {
                return "after"
            }
        }

        const app = new Application({port: 5711})
        const thread = new RaitonThread({workdir: process.cwd(), options: {serve: false}} as any, {serve: false})
        thread.application = app

        const filename = "/virtual/before-rename.controller.ts"
        compileController(BeforeRenameController, app)
        Injection.registerArtifactPath("BeforeRenameController", filename)
        expect((app as any).root.router.getRoutes()).toHaveLength(1)

        await ControllerBuilder.recompile({AfterRenameController}, filename)

        const routes = (app as any).root.router.getRoutes()
        expect(routes).toHaveLength(1)
        expect(routes[0].path).toBe("/after-rename/")

        RaitonThread.reset()
    })

    it("ne duplique pas les routes après 30 recompilations", () => {
        const app = new Application({port: 5711})
        compileController(ReloadedController, app)
        expect((app as any).root.router.getRoutes()).toHaveLength(3)

        for (let index = 0; index < 30; index++) {
            compileController(ReloadedController, app)
        }

        expect((app as any).root.router.getRoutes()).toHaveLength(3)
    })

    it("invalide la pile de middlewares précomposée", async () => {
        const pipeline = new MiddlewarePipeline()
        const calls: string[] = []
        const first = async ({next}: any) => {
            calls.push("first")
            await next()
        }
        const second = async ({next}: any) => {
            calls.push("second")
            await next()
        }

        pipeline.use(first)
        await pipeline.run({}, async () => calls.push("terminal"))
        pipeline.replace("first", second)
        await pipeline.run({}, async () => calls.push("terminal"))

        expect(calls).toEqual(["first", "terminal", "second", "terminal"])
    })

    it("remplace un hook sans duplication", async () => {
        const hooks = new HookStore()
        const calls: string[] = []
        const oldHandler = () => calls.push("old")
        const newHandler = () => calls.push("new")

        hooks.add("onRequest", oldHandler)
        hooks.replace("onRequest", oldHandler, newHandler)
        await hooks.run("onRequest", {})
        await hooks.run("onRequest", {})

        expect(calls).toEqual(["new", "new"])
        expect(hooks.has("onRequest")).toBe(true)
    })
})

describe("conteneur d'injection", () => {
    it("ne résout jamais l'ancienne classe après updateConstruct", () => {
        class ReloadableServiceV1 {
        }

        class ReloadableServiceV2 {
        }

        Injection.registry("HmrReloadableService", ReloadableServiceV1)
        const first = Injection.get("HmrReloadableService")
        expect(first).toBeInstanceOf(ReloadableServiceV1)

        Injection.updateConstruct("HmrReloadableService", ReloadableServiceV2)
        const second = Injection.get("HmrReloadableService")
        expect(second).toBeInstanceOf(ReloadableServiceV2)
        expect(second).not.toBe(first)
    })
})

describe("démarrage", () => {
    it("ne charge ni argon2, ni bcrypt, ni class-validator, ni esbuild à l'import", () => {
        const script = [
            "await import('./source/framework/index.ts');",
            "const keys = Object.keys(require.cache ?? {});",
            "console.log(keys.filter(key => /argon2|bcrypt|class-validator|esbuild/.test(key)).join('\\n') || 'none');",
        ].join("\n");
        const result = spawnSync(process.execPath, ["-e", script], {
            cwd: process.cwd(),
            encoding: "utf-8",
        });

        expect(result.status).toBe(0);
        expect(String(result.stdout).trim()).toBe("none");
    });
})

describe("classification des artefacts", () => {
    it("reconnaît chaque suffixe en un lookup", () => {
        expect(Artifacts.classify("/app/users.controller.ts")?.channel).toBe("hmr:controller")
        expect(Artifacts.classify("/app/user.service.js")?.channel).toBe("hmr:di")
        expect(Artifacts.classify("/app/auth.middleware.ts")?.channel).toBe("hmr:middleware")
        expect(Artifacts.classify("/app/health.health-check.ts")?.artifactType).toBe("health-check")
        expect(Artifacts.classify("/app/not-a-real-file.ts")).toBeNull()
    })
})
