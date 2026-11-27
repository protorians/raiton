import "reflect-metadata";
import path from "node:path";
import fs from "node:fs";
import {afterAll, beforeAll, describe, expect, it} from "bun:test";
import {introspectProject} from "../source/manifest/introspect.ts";
import {invalidateManifest, generateManifest} from "../source/manifest/manifest.ts";
import {getDebugRuntime, getDebugJournal, resetDebugRuntime, rotateDebugBuild} from "../source/debug/runtime.ts";
import {DebugJournal} from "../source/debug/journal.ts";
import {invokeRoute, DebugInvocationError, compareReplay} from "../source/debug/invocation.ts";
import {explainEntry} from "../source/debug/explain.ts";
import {verifyManifest} from "../source/debug/verify.ts";
import {redactValue, redactHeaders, truncateValue} from "../source/debug/redaction.ts";
import {sanitizeIssues} from "../source/contracts/errors.ts";
import {errorPayload, enrichErrorPayload} from "../source/framework/errors/catalog.ts";
import {createDebugMcpEntry, debugMcpToolNames} from "../source/debug/mcp.ts";
import {handleMcpRequest} from "../source/framework/mcp/handler.ts";
import {runAllConformance} from "../source/framework/mcp/conformance.ts";
import {appendSessionEntry, clearSessionJournal, loadSessionJournal} from "../source/debug/session.ts";
import {entryFromInvocation} from "../source/debug/cli.ts";
import {replayPath} from "../source/debug/requests.ts";
import {resolveDebugConfig} from "../source/debug/config.ts";
import {validateConfig} from "../source/core/config/schema.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import {Application} from "../source/core/application.ts";
import {validateManifest} from "../source/manifest/schema.ts";
import type {DebugJournalEntry} from "../source/debug/types.ts";

const FIXTURE = path.join(import.meta.dir, "fixtures", "project");
let application: any;
let manifest: any;

function entry(index: number, overrides: Partial<DebugJournalEntry> = {}): DebugJournalEntry {
    return {
        schemaVersion: "1.0.0",
        requestId: `req-${index}`,
        traceId: `trace-${index}`,
        startedAt: new Date(Date.now() - 10_000 + index).toISOString(),
        request: {method: "GET", route: `/r/${index}`, pattern: `/r/${index}`, path: `/r/${index}`},
        response: {status: 200, durationMs: 1},
        timeline: [],
        release: {hmr: false, buildId: "b1"},
        ...overrides,
    };
}

function mockReply() {
    const reply: any = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined,
        status(code: number) {
            reply.statusCode = code;
            return reply;
        },
        header(name: string, value: any) {
            reply.headers[name] = String(value);
            return reply;
        },
        send(body: any) {
            reply.body = body;
        },
        json(body: any) {
            reply.body = body;
        },
        type() {
            return reply;
        },
    };
    return reply;
}

async function callApp(method: string, url: string, body?: any, headers: Record<string, string> = {}) {
    const reply = mockReply();
    const requestHeaders = new Headers({"content-type": "application/json", ...headers});
    await application.handle({
        method,
        url,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
    }, reply);
    return reply;
}

async function mcp(entry: any, method: string, params?: any, scopes: string[] = ["debug:read", "debug:call"]) {
    const result: any = await handleMcpRequest(entry, {
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
    }, {scopes, transport: "streamable-http", actor: "test"});
    return Array.isArray(result.message) ? result.message[0] : result.message;
}

describe("debug runtime — journal, expurgation et invocation", () => {
    beforeAll(async () => {
        process.env.RAITON_DEBUG = "1";
        invalidateManifest();
        const introspection = await introspectProject(FIXTURE, {refresh: true});
        application = introspection.application;
        manifest = introspection.manifest;
        delete process.env.RAITON_DEBUG;
        expect(getDebugJournal()).toBeDefined();
    });

    afterAll(() => {
        clearSessionJournal(FIXTURE);
        fs.rmSync(path.join(FIXTURE, ".raiton"), {recursive: true, force: true});
        delete process.env.RAITON_DEBUG;
        delete process.env.RAITON_DEBUG_TOKEN;
    });

    it("borne le ring buffer, indexe par requestId et marque les entrées obsolètes", () => {
        const journal = new DebugJournal({capacity: 3, ttlMs: 60_000});
        for (let index = 0; index < 4; index++) journal.push(entry(index));

        expect(journal.size).toBe(3);
        expect(journal.get("req-0")).toBeUndefined();
        expect(journal.get("req-1")?.requestId).toBe("req-1");
        expect(journal.last()?.requestId).toBe("req-3");
        expect(journal.recent({limit: 2}).map(item => item.requestId)).toEqual(["req-3", "req-2"]);
        expect(journal.recent({status: "4xx"})).toHaveLength(0);
        expect(journal.recent({route: "/r/3"})).toHaveLength(1);

        journal.setBuildId("b2");
        expect(journal.get("req-3")?.stale).toBe(true);
    });

    it("expurge récursivement les secrets et tronque les corps", () => {
        const value = redactValue({
            email: "ada@example.com",
            password: "super-secret",
            nested: {authorization: "Bearer abc", token: "abc"},
            list: [{apiKey: "k"}],
        });
        expect(value.password).toBe("***");
        expect(value.nested.authorization).toBe("***");
        expect(value.nested.token).toBe("***");
        expect(value.list[0].apiKey).toBe("***");
        expect(value.email).toBe("ada@example.com");

        const headers = redactHeaders({Authorization: "Bearer abc", "content-type": "application/json"});
        expect(headers.authorization).toBe("***");
        expect(headers["content-type"]).toBe("application/json");

        const truncated: any = truncateValue({name: "x".repeat(100)}, 20);
        expect(truncated.truncated).toBe(true);
        expect(truncated.preview.length).toBeLessThanOrEqual(20);

        const issues = sanitizeIssues([{
            path: "password",
            code: "invalid_string",
            message: "too short",
            received: "secret",
        }]);
        expect(issues[0].received).toBe("***");
    });

    it("résout, valide et invoque une route paramétrique", async () => {
        const runtime = getDebugRuntime()!;
        const result = await invokeRoute({
            manifest,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        }, {
            method: "GET",
            path: "/items/:id",
            params: {id: 42},
        });

        expect(result.response.status).toBe(200);
        expect(result.response.requestId).toBeTruthy();
        expect(result.response.traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(result.contract.input).toBe("absent");
        expect(result.contract.output).toBe("valid");
        expect(result.response.body).toEqual({id: 1, name: "Raiton"});

        const captured = getDebugJournal()!.get(result.response.requestId);
        expect(captured?.source?.file).toContain("items.controller.ts");
        expect(captured?.traceId).toBe(result.response.traceId);
        expect(captured?.timeline.some(step => step.step === "handler")).toBe(true);
    });

    it("n'envoie jamais une charge invalide", async () => {
        const runtime = getDebugRuntime()!;
        const before = getDebugJournal()!.size;
        const result = await invokeRoute({
            manifest,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        }, {
            method: "POST",
            path: "/items",
            body: {name: "x"},
        });

        expect(result.response.status).toBe(0);
        expect(result.contract.input).toBe("invalid");
        expect(result.contract.issues[0].path).toContain("name");
        expect(result.contract.issues[0].expected).toContain("minLength 2");
        expect(result.contract.issues[0].received).toBe("x");
        expect(getDebugJournal()!.size).toBe(before);
    });

    it("affiche la requête résolue en mode simulation", async () => {
        const runtime = getDebugRuntime()!;
        const result = await invokeRoute({
            manifest,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        }, {
            method: "POST",
            path: "/items",
            example: "create",
            dryRun: true,
        });

        expect(result.request.dryRun).toBe(true);
        expect(result.request.body).toEqual({name: "Raiton"});
        expect(result.response.status).toBe(0);
    });

    it("produit des erreurs actionnables pour une route ou un paramètre manquant", async () => {
        const runtime = getDebugRuntime()!;
        const context = {manifest, application, config: runtime.config, workdir: FIXTURE};

        await expect(invokeRoute(context, {method: "GET", path: "/missing"}))
            .rejects.toBeInstanceOf(DebugInvocationError);

        try {
            await invokeRoute(context, {method: "GET", path: "/items/:id"});
            throw new Error("expected failure");
        } catch (error: any) {
            expect(error.code).toBe("MISSING_PATH_PARAMETER");
            expect(error.hint).toContain("--param id=");
        }
    });

    it("signale une violation du contrat de sortie avec la route et le champ", async () => {
        const runtime = getDebugRuntime()!;
        const broken = JSON.parse(JSON.stringify(manifest));
        const route = broken.routes.find((item: any) => item.path === "/items/:id");
        route.outputSchema = {
            type: "object",
            properties: {id: {type: "string"}, name: {type: "string"}},
            required: ["id", "name"],
        };

        const result = await invokeRoute({
            manifest: broken,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        }, {
            method: "GET",
            path: "/items/:id",
            params: {id: 1},
        });

        expect(result.contract.output).toBe("invalid");
        expect(result.contract.issues.some(issue => issue.path.includes("id"))).toBe(true);
    });

    it("explique une erreur de validation sans exécuter le handler", async () => {
        const reply = await callApp("POST", "/api/items", {name: "x"});
        expect(reply.statusCode).toBe(400);
        expect(reply.body.code).toBe("VALIDATION_ERROR");
        expect(reply.body.requestId).toBeTruthy();
        expect(reply.body.hint).toContain("handler was not executed");

        const captured = getDebugJournal()!.get(reply.body.requestId)!;
        const explanation = explainEntry(captured);
        expect(explanation.diagnosis.code).toBe("VALIDATION_ERROR");
        expect(explanation.diagnosis.rootCause).toContain("name");
        expect(explanation.diagnosis.hint).toContain("handler was not executed");
        expect(explanation.timeline.some(step => step.step === "handler" && step.result === "not-executed")).toBe(true);
        expect(explanation.timeline.some(step => step.step === "validation:input" && step.result === "rejected")).toBe(true);
        expect(explanation.nextActions.length).toBeGreaterThan(0);
    });

    it("génère des exemples et des codes d'erreur dans le manifeste", async () => {
        const generated = generateManifest({workdir: FIXTURE});
        expect(validateManifest(generated).valid).toBe(true);
        const item = generated.routes.find(route => route.path === "/items/:id")!;
        expect(item.examples?.[0].params?.id).toBeDefined();
        expect(item.examples?.[0].expectedStatus).toBe(200);
        expect(item.errors?.some(error => error.code === "OUTPUT_VALIDATION_ERROR")).toBe(true);

        const create = generated.routes.find(route => route.method === "POST" && route.path === "/items/")!;
        expect(create.examples?.some(example => example.name === "create")).toBe(true);
    });

    it("vérifie les contrats, saute les méthodes non idempotentes et détecte une rupture", async () => {
        const runtime = getDebugRuntime()!;
        const selected = {...manifest, routes: manifest.routes.filter((route: any) => route.path.includes("/items"))};
        const report = await verifyManifest({
            manifest: selected,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        });

        expect(report.summary.passed).toBeGreaterThanOrEqual(1);
        expect(report.summary.skipped).toBe(1);
        expect(report.results.find(result => result.method === "POST")?.reason).toContain("Non-idempotent");

        const broken = JSON.parse(JSON.stringify(selected));
        broken.routes.find((route: any) => route.path === "/items/:id").outputSchema = {
            type: "object",
            properties: {id: {type: "string"}, name: {type: "string"}},
            required: ["id", "name"],
        };
        const failing = await verifyManifest({
            manifest: broken,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        });
        const failure = failing.results.find(result => result.path === "/items/:id")!;
        expect(failure.passed).toBe(false);
        expect(failure.field).toContain("id");
        expect(failure.source).toContain("items.controller.ts");
    });

    it("expose les outils MCP de debug et passe la conformité HTTP + stdio", async () => {
        const runtime = getDebugRuntime()!;
        createDebugMcpEntry(runtime.config.mcp.path);
        const entry = (await import("../source/core/mcp/metadata.ts")).getMcpServer("raiton-debug")!;

        const listing = await mcp(entry, "tools/list");
        const names = listing.result.tools.map((tool: any) => tool.name);
        for (const name of debugMcpToolNames()) {
            if (name === "requests.replay") {
                expect(names).not.toContain(name);
            } else {
                expect(names).toContain(name);
            }
        }
        expect(listing.result.tools.find((tool: any) => tool.name === "routes.list").annotations.readOnlyHint).toBe(true);

        const routes = await mcp(entry, "tools/call", {name: "routes.list", arguments: {}});
        expect(routes.result.isError).toBe(false);
        expect(Array.isArray(routes.result.structuredContent.routes)).toBe(true);

        const invalid = await mcp(entry, "tools/call", {name: "routes.get", arguments: {method: "GET"}});
        expect(invalid.result.structuredContent.code).toBe("MCP_INVALID_ARGUMENTS");

        const call = await mcp(entry, "tools/call", {
            name: "routes.call",
            arguments: {method: "GET", path: "/items/:id", params: {id: 1}},
        });
        expect(call.result.isError).toBe(false);
        expect(call.result.structuredContent.response.status).toBe(200);

        const conformance = await runAllConformance(entry);
        expect(conformance.map(result => result.transport).sort()).toEqual(["stdio", "streamable-http"]);
        for (const result of conformance) expect(result.passed).toBe(true);
    });

    it("sert les surfaces HTTP et protège le jeton", async () => {
        const runtime = getDebugRuntime()!;
        await callApp("GET", "/api/items/1");

        const requests = await callApp("GET", "/api/__raiton/requests");
        expect(requests.statusCode).toBe(200);
        expect(requests.body.schemaVersion).toBe("1.0.0");
        expect(requests.body.count).toBeGreaterThan(0);
        expect(requests.body.requests[0].requestId).toBeTruthy();
        expect(requests.body.entries).toBeUndefined();

        const id = requests.body.requests[0].requestId;
        const explanation = await callApp("GET", `/api/__raiton/explain/${id}`);
        expect(explanation.statusCode).toBe(200);
        expect(explanation.body.diagnosis).toBeDefined();

        const called = await callApp("POST", "/api/__raiton/call", {
            method: "GET",
            path: "/items/1",
        });
        expect(called.statusCode).toBe(200);
        expect(called.body.response.status).toBe(200);

        runtime.config.http.token = "test-token";
        try {
            const denied = await callApp("GET", "/api/__raiton/requests");
            expect(denied.statusCode).toBe(401);
            const allowed = await callApp("GET", "/api/__raiton/requests", undefined, {
                "x-raiton-debug-token": "test-token",
            });
            expect(allowed.statusCode).toBe(200);
        } finally {
            runtime.config.http.token = undefined;
        }
    });

    it("rejoue une requête idempotente depuis le journal", async () => {
        const runtime = getDebugRuntime()!;
        const first = await invokeRoute({
            manifest,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        }, {method: "GET", path: "/items/:id", params: {id: 7}});
        const captured = getDebugJournal()!.get(first.response.requestId)!;

        const replay = await invokeRoute({
            manifest,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        }, {
            method: captured.request.method,
            path: replayPath(captured),
            params: captured.request.params,
            headers: captured.request.headers,
            replayedFrom: captured.requestId,
        });
        expect(replay.response.status).toBe(first.response.status);
        expect(replay.replayedFrom).toBe(first.response.requestId);
        const comparison = compareReplay(captured, replay);
        expect(comparison.status).toBe("same");
        expect(comparison.previousStatus).toBe(first.response.status);
        expect(comparison.currentStatus).toBe(replay.response.status);
    });

    it("n'expose ni valeurs attendues/reçues ni emplacement hors développement", async () => {
        const reply = await callApp("POST", "/api/items", {name: "x"});
        expect(reply.statusCode).toBe(400);
        const detail = reply.body.details[0];
        expect(detail.path).toBe("name");
        expect(detail.code).toBeTruthy();
        expect(detail.expected).toBeUndefined();
        expect(detail.received).toBeUndefined();
        expect(detail.location).toBeUndefined();
        expect(reply.body.stack).toBeUndefined();
        expect(reply.body.location).toBeUndefined();
        expect(reply.body.schemaVersion).toBe("1.0.0");
    });

    it("signale une version de manifeste ou d'entrée inconnue", () => {
        invalidateManifest();
        const generated = generateManifest({workdir: FIXTURE, refresh: true});
        const invalid = validateManifest({...generated, schemaVersion: "9.0.0"});
        expect(invalid.valid).toBe(false);
        expect(invalid.errors[0].message).toContain("Unsupported manifest schema version");

        const captured = getDebugJournal()!.last()!;
        expect(() => explainEntry({...captured, schemaVersion: "9.0.0"})).toThrow(/Unsupported debug schema version/);
    });

    it("conserve les entrées CLI bornées pour expliquer un appel ultérieur", async () => {
        const runtime = getDebugRuntime()!;
        const result = await invokeRoute({
            manifest,
            application,
            config: runtime.config,
            workdir: FIXTURE,
        }, {method: "GET", path: "/items/:id", params: {id: 3}});
        appendSessionEntry(entryFromInvocation(manifest, {
            method: "GET",
            path: "/items/:id",
            params: {id: 3},
        }, result), FIXTURE);

        const journal = loadSessionJournal(FIXTURE);
        expect(journal.get(result.response.requestId)).toBeDefined();
    });

    it("marque les entrées obsolètes après un rechargement à chaud", async () => {
        const before = await invokeRoute({
            manifest,
            application,
            config: getDebugRuntime()!.config,
            workdir: FIXTURE,
        }, {method: "GET", path: "/items/:id", params: {id: 11}});
        const entry = getDebugJournal()!.get(before.response.requestId)!;
        rotateDebugBuild();
        expect(entry.stale).toBe(true);

        const after = await invokeRoute({
            manifest,
            application,
            config: getDebugRuntime()!.config,
            workdir: FIXTURE,
        }, {method: "GET", path: "/items/:id", params: {id: 12}});
        expect(getDebugJournal()!.get(after.response.requestId)?.stale).toBeFalsy();
    });
});

describe("debug configuration et erreurs enrichies", () => {
    it("valide la section debug et les valeurs par défaut de production", () => {
        const invalid = validateConfig({debug: {journal: {capture: "everything", sampleRate: 2}}});
        expect(invalid.valid).toBe(false);
        expect(invalid.errors.some(error => error.field === "debug.journal.capture")).toBe(true);
        expect(invalid.errors.some(error => error.field === "debug.journal.sampleRate")).toBe(true);

        RaitonConfig.reset();
        const production = resolveDebugConfig({development: false});
        expect(production.enabled).toBe(false);
        expect(production.journal.enabled).toBe(false);
        expect(production.http.enabled).toBe(false);
    });

    it("ajoute code, documentation, corrélation et action aux erreurs", () => {
        const payload = errorPayload("VALIDATION_ERROR", {requestId: "req-1"});
        expect(payload.code).toBe("VALIDATION_ERROR");
        expect(payload.docsUrl).toContain("contracts.md");
        expect(payload.requestId).toBe("req-1");
        expect(payload.hint).toContain("handler");
        expect(payload.stack).toBeUndefined();

        const enriched = enrichErrorPayload({code: "INTERNAL_SERVER_ERROR", token: "secret"}, 500, "req-2");
        expect(enriched.requestId).toBe("req-2");
        expect(enriched.hint).toBeTruthy();
        expect(enriched.token).toBe("***");
        expect(enriched.stack).toBeUndefined();
    });

    it("ne monte aucune surface de debug en production sans activation", async () => {
        RaitonConfig.reset();
        resetDebugRuntime();
        const app = new Application({port: 65001});
        try {
            const reply = mockReply();
            await app.handle({
                method: "GET",
                url: "/__raiton/requests",
                headers: new Headers(),
            }, reply);
            expect(reply.statusCode).toBe(404);
        } finally {
            resetDebugRuntime();
        }
    });
});
