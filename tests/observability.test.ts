import "reflect-metadata";
import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {Application} from "../source/core/application.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import {resolveRequestId, generateRequestId} from "../source/framework/observability/request.ts";
import {metrics} from "../source/framework/observability/metrics.ts";
import {currentTrace, traceparent, tracedFetch, withSpan} from "../source/framework/observability/trace.ts";
import {Readiness} from "../source/framework/observability/readiness.ts";
import {shutdown} from "../source/framework/observability/shutdown.ts";
import {HealthCheckManager, registerDefaultHealthCheck} from "../source/framework/health-check.ts";
import {errorPayload, ERROR_CATALOG} from "../source/framework/errors/catalog.ts";

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

function request(url: string, headers: Record<string, string> = {}) {
    return {
        reply: new MockReply(),
        input: {method: "GET", url, headers: new Headers(headers)},
    };
}

describe("observabilité", () => {
    beforeEach(() => {
        RaitonConfig.reset();
        metrics.reset();
        shutdown.reset();
        Readiness.markReady();
        process.env.RAITON_OBSERVABILITY = "all";
        process.env.RAITON_REQUEST_ID_HEADER = "x-request-id";
    });

    afterEach(() => {
        delete process.env.RAITON_OBSERVABILITY;
        delete process.env.RAITON_REQUEST_ID_HEADER;
        metrics.reset();
        shutdown.reset();
        Readiness.markReady();
    });

    it("réutilise un identifiant de corrélation valide et rejette les valeurs injectables", () => {
        expect(resolveRequestId({headers: new Headers({"x-request-id": "req-123"})})).toBe("req-123");
        const generated = resolveRequestId({headers: new Headers({"x-request-id": "bad value\n"})});
        expect(generated).not.toContain("\n");
        expect(generated).toBeTruthy();
        expect(generateRequestId()).not.toBe(generateRequestId());
    });

    it("expose l'identifiant dans la réponse et collecte les métriques", async () => {
        const app = new Application({port: 5711});
        app.get("/ping", () => ({ok: true}));

        const first = request("/ping", {"x-request-id": "req-abc"});
        await app.handle(first.input, first.reply);

        expect(first.reply.statusCode).toBe(200);
        expect(first.reply.headers.get("x-request-id")).toBe("req-abc");

        const second = request("/metrics");
        await app.handle(second.input, second.reply);

        expect(second.reply.statusCode).toBe(200);
        expect(second.reply.contentType).toContain("text/plain");
        expect(String(second.reply.body)).toContain("http_requests_total");
        expect(String(second.reply.body)).toContain('route="/ping"');
    });

    it("corrèle les spans entrants et sortants", async () => {
        const originalFetch = globalThis.fetch;
        let capturedTraceparent: string | null = null;

        globalThis.fetch = (async (_input: any, init?: RequestInit) => {
            capturedTraceparent = new Headers(init?.headers).get("traceparent");
            return new Response("ok");
        }) as typeof fetch;

        try {
            await withSpan("incoming", async () => {
                const context = currentTrace()!;
                expect(context.traceId).toHaveLength(32);
                expect(traceparent(context)).toContain(context.traceId);

                await tracedFetch("http://example.test/outgoing", {method: "POST"});
            });
        } finally {
            globalThis.fetch = originalFetch;
        }

        expect(capturedTraceparent).toBeTruthy();
        const [, traceId] = capturedTraceparent!.split("-");
        expect(traceId).toHaveLength(32);
    });

    it("fait échouer la disponibilité dès le début de l'arrêt", async () => {
        const app = new Application({port: 5711});
        registerDefaultHealthCheck(app);
        const release = shutdown.track();

        const draining = shutdown.drain(1000);
        const {reply} = request("/health");
        await app.handle({method: "GET", url: "/health", headers: new Headers()}, reply);

        expect(reply.statusCode).toBe(503);
        expect(reply.body.code).toBe("SERVICE_UNAVAILABLE");

        release();
        const result = await draining;
        expect(result.drained).toBe(true);
        expect(shutdown.activeRequests).toBe(0);
    });

    it("draîne dans la limite configurée", async () => {
        const releaseOne = shutdown.track();
        const releaseTwo = shutdown.track();
        const drain = shutdown.drain(10);

        setTimeout(() => {
            releaseOne();
            releaseTwo();
        }, 5);

        const result = await drain;
        expect(result.drained).toBe(true);
    });

    it("expose un catalogue d'erreurs stable", () => {
        expect(ERROR_CATALOG.NOT_FOUND.status).toBe(404);
        const payload = errorPayload("VALIDATION_ERROR", {
            requestId: "req-1",
            details: [{path: "email", code: "invalid_format", message: "Invalid email"}],
        });
        expect(payload.code).toBe("VALIDATION_ERROR");
        expect(payload.statusCode).toBe(400);
        expect(payload.docsUrl).toContain("docs");
        expect(payload.requestId).toBe("req-1");
    });

    it("retourne healthy quand la disponibilité est restaurée", async () => {
        const result = await HealthCheckManager.handleHealthCheck({} as any);
        expect(result.statusCode).toBe(200);
    });
});
