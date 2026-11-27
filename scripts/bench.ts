#!/usr/bin/env bun
/**
 * Harnais de benchmark unifié (specs 001 et 002).
 *
 * Couvre le routage, la pile HTTP, la validation de réponse, le body parser,
 * le démarrage à froid, le reload HMR et la classification d'artefacts.
 * Produit un rapport Markdown/JSON et vérifie les budgets avec `--check`.
 *
 * Exemples :
 *   bun run bench
 *   bun run bench --check
 *   bun run bench --json --check
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {Application} from "../source/core/application.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import {Router} from "../source/core/router/router.ts";
import {compileController} from "../source/core/controller/compiler.ts";
import {Injection} from "../source/core/injection/injection.ts";
import {RaitonThread} from "../source/core/thread.ts";
import {Raiton} from "../source/core/raiton.ts";
import {Artifacts} from "../source/framework/artifacts.ts";
import {CacheManager} from "../source/framework/cache/cache.ts";
import {Controllable} from "../source/framework/decorators/controllable.decorator.ts";
import {Get, Post} from "../source/framework/decorators/routable.decorator.ts";
import {ApiOkResponse} from "../source/framework/decorators/api-response.decorator.ts";
import {Body} from "../source/framework/decorators/parametrable.decorator.ts";
import {readRawBody} from "../source/framework/plugins/body-parser.plugin.ts";
import {IsBoolean, IsEmail, IsInt, IsString, Length, Max, Min} from "class-validator";

type Mode = "off" | "metrics" | "traces";

class BenchReply {
    statusCode = 200;
    body: any;

    status(code: number) {
        this.statusCode = code;
    }

    header() {
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

    type() {
    }
}

const WARMUP_ROUTES = 2_000;
const ROUTE_ITERATIONS = 40_000;
const HTTP_WARMUP = 500;
const HTTP_ITERATIONS = 3_000;

function percentile(samples: number[], p: number): number {
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function median(samples: number[]): number {
    return percentile(samples, 0.5);
}

function measureSync(fn: () => void, iterations = ROUTE_ITERATIONS, rounds = 7, warmup = WARMUP_ROUTES): {
    p50: number;
    p90: number;
    iterations: number;
} {
    for (let index = 0; index < warmup; index++) fn();

    const samples: number[] = [];
    for (let round = 0; round < rounds; round++) {
        const started = performance.now();
        for (let index = 0; index < iterations; index++) fn();
        samples.push(((performance.now() - started) / iterations) * 1000);
    }

    return {
        p50: median(samples),
        p90: percentile(samples, 0.9),
        iterations,
    };
}

async function measureHttp(app: Application, request: any, iterations = HTTP_ITERATIONS): Promise<{
    p50: number;
    p90: number;
    throughput: number;
}> {
    for (let index = 0; index < HTTP_WARMUP; index++) {
        await app.handle(request, new BenchReply());
    }

    const samples: number[] = [];
    const started = performance.now();
    for (let index = 0; index < iterations; index++) {
        const before = performance.now();
        await app.handle(request, new BenchReply());
        samples.push((performance.now() - before) * 1000);
    }
    const elapsed = performance.now() - started;

    return {
        p50: percentile(samples, 0.5),
        p90: percentile(samples, 0.95),
        throughput: iterations / (elapsed / 1000),
    };
}

function resetRuntime() {
    RaitonConfig.reset();
    RaitonThread.reset();
    Raiton.resetThread();
    CacheManager.clear();
}

function createRouter(routeCount: number, targetPosition: "first" | "middle" | "last") {
    const router = new Router();
    const target = () => ({ok: true});
    const addTarget = () => router.add("GET" as any, "/health", target);

    if (targetPosition === "first") addTarget();

    for (let index = 0; index < routeCount; index++) {
        router.add("GET" as any, `/res${index}/:id`, () => ({ok: true}));
        if (targetPosition === "middle" && index === Math.floor(routeCount / 2)) addTarget();
    }

    if (targetPosition === "last") addTarget();
    return router;
}

function routingScenario() {
    const routerFirst = createRouter(300, "first");
    const routerMiddle = createRouter(300, "middle");
    const routerLast = createRouter(300, "last");

    const first = measureSync(() => routerFirst.resolve("GET", "/health"));
    const middle = measureSync(() => routerMiddle.resolve("GET", "/health"));
    const last = measureSync(() => routerLast.resolve("GET", "/health"));

    const param = measureSync(() => routerLast.resolve("GET", "/res299/42"));

    const routerHundred = new Router();
    for (let index = 0; index < 100; index++) routerHundred.add("GET" as any, `/r${index}/:id`, () => null);
    routerHundred.add("GET" as any, "/health", () => null);

    const routerThousand = new Router();
    for (let index = 0; index < 1000; index++) routerThousand.add("GET" as any, `/r${index}/:id`, () => null);
    routerThousand.add("GET" as any, "/health", () => null);

    const hundred = measureSync(() => routerHundred.resolve("GET", "/health"));
    const thousand = measureSync(() => routerThousand.resolve("GET", "/health"));

    const orderRatio = first.p50 > 0 ? last.p50 / first.p50 : 0;
    const scaleRatio = hundred.p50 > 0 ? thousand.p50 / hundred.p50 : 0;

    return {first, middle, last, param, hundred, thousand, orderRatio, scaleRatio};
}

async function httpScenario() {
    const sample = async (routeCount: number, targetPosition: "first" | "last") => {
        resetRuntime();
        const app = new Application({port: 5711});
        const addTarget = () => app.get("/health", () => ({ok: true}));

        if (targetPosition === "first") addTarget();
        for (let index = 0; index < routeCount; index++) {
            app.get(`/res${index}/:id`, () => ({ok: true}));
        }
        if (targetPosition === "last") addTarget();

        const request = {method: "GET", url: "/health", headers: new Headers()};
        return await measureHttp(app, request);
    };

    return {
        zero: await sample(0, "last"),
        hundredFirst: await sample(100, "first"),
        hundredLast: await sample(100, "last"),
        threeHundredFirst: await sample(300, "first"),
        threeHundredLast: await sample(300, "last"),
    };
}

class BenchDto {
    @IsString()
    name!: string;

    @IsEmail()
    email!: string;

    @IsInt()
    age!: number;

    @Min(0)
    @Max(150)
    score!: number;

    @IsBoolean()
    active!: boolean;

    @Length(2, 20)
    login!: string;

    @IsString()
    city!: string;

    @IsString()
    country!: string;
}

@Controllable("/bench-validation")
class BenchValidationController {
    @Get("/")
    @ApiOkResponse("valid", BenchDto)
    valid() {
        return {
            name: "Ada",
            email: "ada@example.com",
            age: 36,
            score: 42,
            active: true,
            login: "ada",
            city: "London",
            country: "UK",
        };
    }
}

async function validationScenario() {
    const entry = {
        name: "Ada",
        email: "ada@example.com",
        age: 36,
        score: 42,
        active: true,
        login: "ada",
        city: "London",
        country: "UK",
    };

    const measure = async (nodeEnv: string) => {
        process.env.NODE_ENV = nodeEnv;
        resetRuntime();
        const app = new Application({port: 5711});
        for (let index = 0; index < 300; index++) {
            app.get(`/res${index}/:id`, () => ({ok: true}));
        }
        compileController(BenchValidationController, app);
        const request = {method: "GET", url: "/bench-validation", headers: new Headers()};
        return await measureHttp(app, request, 2_000);
    };

    const development = await measure("development");
    const production = await measure("production");
    return {development, production, dtoFields: 8, sample: entry};
}

@Controllable("/bench-body")
class BenchBodyController {
    @Post("/")
    @ApiOkResponse("echo")
    echo(@Body() body: any) {
        return body;
    }
}

async function bodyScenario() {
    resetRuntime();
    const app = new Application({port: 5711});
    compileController(BenchBodyController, app);

    const payload = JSON.stringify({message: "x".repeat(520)});
    const bytes = new TextEncoder().encode(payload).byteLength;

    const measure = async (size: number) => {
        const raw = JSON.stringify({message: "x".repeat(Math.max(0, size - 30))});
        const samples: number[] = [];
        for (let index = 0; index < HTTP_WARMUP; index++) {
            const request = {
                method: "POST",
                url: "/bench-body",
                headers: new Headers({"content-type": "application/json"}),
                body: new Blob([raw]).stream(),
            };
            await app.handle(request, new BenchReply());
        }
        for (let index = 0; index < 1_500; index++) {
            const request = {
                method: "POST",
                url: "/bench-body",
                headers: new Headers({"content-type": "application/json"}),
                body: new Blob([raw]).stream(),
            };
            const before = performance.now();
            await app.handle(request, new BenchReply());
            samples.push((performance.now() - before) * 1000);
        }
        return {p50: percentile(samples, 0.5), p90: percentile(samples, 0.95), bytes: new TextEncoder().encode(raw).byteLength};
    };

    const readSamples: number[] = [];
    for (let index = 0; index < HTTP_WARMUP; index++) await readRawBody(new Blob([payload]).stream());
    for (let index = 0; index < 2_000; index++) {
        const body = new Blob([payload]).stream();
        const before = performance.now();
        await readRawBody(body);
        readSamples.push((performance.now() - before) * 1000);
    }

    return {
        small: await measure(bytes),
        large: await measure(10_000),
        read: {
            p50: percentile(readSamples, 0.5),
            p90: percentile(readSamples, 0.95),
            bytes: new TextEncoder().encode(payload).byteLength,
        },
        bytes,
    };
}

function coldImport(entry: string): number[] {
    const absolute = path.resolve(entry);
    const script = `const start = performance.now(); await import(${JSON.stringify(absolute)}); console.log((performance.now() - start).toFixed(3))`;
    const samples: number[] = [];
    for (let index = 0; index < 5; index++) {
        const result = spawnSync(process.execPath, ["-e", script], {
            cwd: process.cwd(),
            encoding: "utf-8",
        });
        const value = Number(String(result.stdout).trim());
        if (Number.isFinite(value)) samples.push(value);
    }
    return samples;
}

function startupScenario() {
    const framework = coldImport("./source/framework/index.ts");
    const decorators = coldImport("./source/framework/decorators/index.ts");
    return {
        framework: {samples: framework, p50: median(framework)},
        decorators: {samples: decorators, p50: median(decorators)},
    };
}

async function hmrScenario() {
    resetRuntime();
    const app = new Application({port: 5711});
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "raiton-bench-hmr-"));
    const file = path.join(directory, "bench.controller.ts")
    const decoratorsBase = path.resolve("./source/framework/decorators").replace(/\\/g, "/")
    fs.writeFileSync(file, `
import {Controllable} from "file://${decoratorsBase}/controllable.decorator.ts";
import {Get} from "file://${decoratorsBase}/routable.decorator.ts";

@Controllable("/bench-hmr")
export class BenchHmrController {
    @Get("/a") a() { return "a" }
    @Get("/b") b() { return "b" }
    @Get("/c") c() { return "c" }
}
`, "utf-8")

    const samples: number[] = [];
    try {
        for (let index = 0; index < 30; index++) {
            const before = performance.now();
            const imported = await import(`${file}?v=1&t=${Date.now()}-${index}`)
            compileController(imported.BenchHmrController, app)
            samples.push(performance.now() - before);
        }
    } finally {
        fs.rmSync(directory, {recursive: true, force: true});
    }

    const routes = (app as any).root.router.getRoutes();
    return {
        p50: percentile(samples, 0.5),
        p90: percentile(samples, 0.9),
        reloads: samples.length,
        routes: routes.length,
    };
}

function classificationScenario() {
    const filenames = Array.from({length: 5000}, (_, index) => `/app/module-${index}.service.ts`);
    const measured = measureSync(() => {
        for (const filename of filenames) Artifacts.classify(filename);
    }, 1, 5, 3);
    // measureSync returns microseconds per iteration; a classification batch is
    // one iteration, so convert back to milliseconds.
    return {
        files: filenames.length,
        p50: measured.p50 / 1000,
        p90: measured.p90 / 1000,
        iterations: measured.iterations,
    };
}

async function observabilityScenario() {
    const measure = async (mode: Mode) => {
        process.env.RAITON_OBSERVABILITY = mode;
        delete process.env.RAITON_OTEL_ENDPOINT;
        resetRuntime();
        const app = new Application({port: 5711});
        for (let index = 0; index < 300; index++) {
            app.get(`/res${index}/:id`, () => ({ok: true}));
        }
        app.get("/health", () => ({ok: true}));
        const request = {method: "GET", url: "/health", headers: new Headers()};
        return await measureHttp(app, request, 2_000);
    };

    const off = await measure("off");
    const metrics = await measure("metrics");
    const traces = await measure("traces");
    delete process.env.RAITON_OBSERVABILITY;

    return {
        off,
        metrics,
        traces,
        metricsOverhead: off.p50 > 0 ? ((metrics.p50 - off.p50) / off.p50) * 100 : 0,
        tracesOverhead: off.p50 > 0 ? ((traces.p50 - off.p50) / off.p50) * 100 : 0,
    };
}

function formatTable(title: string, rows: Array<[string, ...string[]]>, headers: string[]) {
    const lines = [`### ${title}`, "", `| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`];
    for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
    lines.push("");
    return lines.join("\n");
}

async function main() {
    process.env.NODE_ENV = "production";
    const routing = routingScenario();
    const http = await httpScenario();
    const validation = await validationScenario();
    const body = await bodyScenario();
    const startup = startupScenario();
    const hmr = await hmrScenario();
    const classification = classificationScenario();
    const observability = await observabilityScenario();
    const memory = process.memoryUsage()

    const report = {
        generatedAt: new Date().toISOString(),
        environment: {
            runtime: `Bun ${Bun.version}`,
            node: process.version,
            platform: `${process.platform}-${process.arch}`,
            cpus: os.cpus().length,
            iterations: {routing: ROUTE_ITERATIONS, http: HTTP_ITERATIONS},
        },
        memory: {
            rssMB: memory.rss / (1024 * 1024),
            heapUsedMB: memory.heapUsed / (1024 * 1024),
        },
        routing,
        http,
        validation,
        body,
        startup,
        hmr,
        classification,
        observability,
    };

    const markdown = [
        "# Raiton performance benchmark",
        "",
        `Généré le ${report.generatedAt} · Bun ${Bun.version} · ${report.environment.platform}`,
        "",
        `Mémoire : **${report.memory.rssMB.toFixed(1)} Mo RSS** · **${report.memory.heapUsedMB.toFixed(1)} Mo heap**`,
        "",
        formatTable("Routage (µs / requête)", [
            ["Cible en premier (300 routes)", routing.first.p50.toFixed(3), routing.first.p90.toFixed(3)],
            ["Cible au milieu (300 routes)", routing.middle.p50.toFixed(3), routing.middle.p90.toFixed(3)],
            ["Cible en dernier (300 routes)", routing.last.p50.toFixed(3), routing.last.p90.toFixed(3)],
            ["Paramétrique /res299/:id", routing.param.p50.toFixed(3), routing.param.p90.toFixed(3)],
            ["100 routes statiques", routing.hundred.p50.toFixed(3), routing.hundred.p90.toFixed(3)],
            ["1 000 routes statiques", routing.thousand.p50.toFixed(3), routing.thousand.p90.toFixed(3)],
        ], ["Scénario", "p50", "p90"]),
        `Ratio ordre (dernier / premier) : **${routing.orderRatio.toFixed(2)}×** · ratio échelle (1 000 / 100) : **${routing.scaleRatio.toFixed(2)}×**`,
        "",
        formatTable("Pile HTTP complète (µs / requête)", [
            ["0 route + cible", http.zero.p50.toFixed(3), http.zero.p90.toFixed(3), Math.round(http.zero.throughput).toString()],
            ["100 routes, cible en premier", http.hundredFirst.p50.toFixed(3), http.hundredFirst.p90.toFixed(3), Math.round(http.hundredFirst.throughput).toString()],
            ["100 routes, cible en dernier", http.hundredLast.p50.toFixed(3), http.hundredLast.p90.toFixed(3), Math.round(http.hundredLast.throughput).toString()],
            ["300 routes, cible en premier", http.threeHundredFirst.p50.toFixed(3), http.threeHundredFirst.p90.toFixed(3), Math.round(http.threeHundredFirst.throughput).toString()],
            ["300 routes, cible en dernier", http.threeHundredLast.p50.toFixed(3), http.threeHundredLast.p90.toFixed(3), Math.round(http.threeHundredLast.throughput).toString()],
        ], ["Scénario", "p50", "p90", "req/s"]),
        formatTable("Validation de réponse (µs / requête)", [
            ["Développement (validation active)", validation.development.p50.toFixed(3), validation.development.p90.toFixed(3)],
            ["Production (validation désactivée)", validation.production.p50.toFixed(3), validation.production.p90.toFixed(3)],
        ], ["Scénario", "p50", "p90"]),
        formatTable("Body parser (µs / requête)", [
            ["Lecture native JSON 547 octets", body.read.p50.toFixed(3), body.read.p90.toFixed(3), String(body.read.bytes)],
            ["POST JSON 547 octets (pile complète)", body.small.p50.toFixed(3), body.small.p90.toFixed(3), String(body.small.bytes)],
            ["POST JSON 10 Ko (pile complète)", body.large.p50.toFixed(3), body.large.p90.toFixed(3), String(body.large.bytes)],
        ], ["Scénario", "p50", "p90", "Octets"]),
        formatTable("Démarrage à froid (ms)", [
            ["Import framework", startup.framework.p50.toFixed(1)],
            ["Import decorators", startup.decorators.p50.toFixed(1)],
        ], ["Entrée", "p50"]),
        formatTable("HMR et classification", [
            ["Reload contrôleur 3 routes (ms)", hmr.p50.toFixed(3), hmr.p90.toFixed(3)],
            ["Classification 5 000 fichiers (ms)", classification.p50.toFixed(3), classification.p90.toFixed(3)],
        ], ["Scénario", "p50", "p90"]),
        formatTable("Observabilité", [
            ["off", observability.off.p50.toFixed(3), "0.00 %"],
            ["metrics", observability.metrics.p50.toFixed(3), `${observability.metricsOverhead.toFixed(2)} %`],
            ["traces", observability.traces.p50.toFixed(3), `${observability.tracesOverhead.toFixed(2)} %`],
        ], ["Mode", "p50 (µs)", "Surcoût p50"]),
    ].join("\n");

    console.log(markdown);

    const outDir = process.argv.includes("--out")
        ? path.resolve(process.argv[process.argv.indexOf("--out") + 1])
        : path.resolve("benchmarks");
    if (!process.argv.includes("--no-write")) {
        fs.mkdirSync(outDir, {recursive: true});
        fs.writeFileSync(path.join(outDir, "latest.md"), markdown + "\n", "utf-8");
        fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
    }

    if (process.argv.includes("--json")) {
        console.log("\n```json");
        console.log(JSON.stringify(report, null, 2));
        console.log("```");
    }

    if (process.argv.includes("--check")) {
        const failures: string[] = [];
        const check = (label: string, value: number, budget: number, unit = "") => {
            if (value > budget) failures.push(`${label}: ${value.toFixed(3)}${unit} > ${budget}${unit}`);
        };

        // Spec 001, scénario A/B/SC-002/SC-003.
        check("ratio ordre de routage", routing.orderRatio, 2, "×");
        check("ratio échelle 1000/100 routes", routing.scaleRatio, 2, "×");
        check("HTTP 300 routes cible en dernier (p50)", http.threeHundredLast.p50, Number(process.env.BENCH_HTTP_BUDGET_US ?? 5), " µs");
        check("validation production (p50)", validation.production.p50, Number(process.env.BENCH_VALIDATION_BUDGET_US ?? 5), " µs");
        check("lecture corps JSON 547 octets (p50)", body.read.p50, Number(process.env.BENCH_BODY_READ_BUDGET_US ?? 2.5), " µs");
        check("POST JSON 547 octets (p50)", body.small.p50, Number(process.env.BENCH_BODY_BUDGET_US ?? 12), " µs");
        check("import framework (p50)", startup.framework.p50, Number(process.env.BENCH_FRAMEWORK_IMPORT_MS ?? 60), " ms");
        check("import decorators (p50)", startup.decorators.p50, Number(process.env.BENCH_DECORATORS_IMPORT_MS ?? 30), " ms");
        check("reload HMR (p50)", hmr.p50, Number(process.env.BENCH_HMR_BUDGET_MS ?? 2), " ms");

        if (hmr.routes !== 3) failures.push(`routes après 30 reloads: ${hmr.routes} != 3`);
        check("classification 5 000 fichiers (p50)", classification.p50, Number(process.env.BENCH_CLASSIFICATION_BUDGET_MS ?? 5.3), " ms");

        // Spec 002 : garde-fous reportés (opt-in via --check-observability).
        if (process.argv.includes("--check-observability")) {
            check("surcoût metrics", observability.metricsOverhead, 5, " %");
            check("surcoût traces", observability.tracesOverhead, 10, " %");
        }

        if (failures.length) {
            console.error("\nBudgets dépassés :");
            for (const failure of failures) console.error(` - ${failure}`);
            process.exitCode = 1;
        } else {
            console.log("\nTous les budgets spec 001 sont respectés.");
        }
    }
}

await main();
