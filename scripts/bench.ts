#!/usr/bin/env bun
/**
 * Unified benchmark harness for specs 001 and 002.
 *
 * Measures the framework hot path with observability disabled/off, metrics and
 * traces. The `--check` flag enforces the spec 002 budgets: metrics ≤ 5 % p50,
 * traces ≤ 10 % p50, off = baseline.
 */
import {Application} from "../source/core/application.ts";
import {RaitonConfig} from "../source/core/config/config.ts";
import {metrics} from "../source/framework/observability/metrics.ts";
import {shutdown} from "../source/framework/observability/shutdown.ts";
import {Readiness} from "../source/framework/observability/readiness.ts";

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

const WARMUP = 2_000;
const ITERATIONS = 15_000;

function percentile(samples: number[], p: number): number {
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

async function measure(mode: Mode): Promise<{mode: Mode; p50: number; p95: number; throughput: number}> {
    process.env.RAITON_OBSERVABILITY = mode;
    delete process.env.RAITON_OTEL_ENDPOINT;
    RaitonConfig.reset();
    metrics.reset();
    shutdown.reset();
    Readiness.markReady();

    const app = new Application({port: 5711});

    // Scenario A of the spec 001 harness: 300 routes, target registered last.
    const routeCount = Number(process.env.BENCH_ROUTES ?? 300);
    for (let index = 0; index < routeCount; index++) {
        app.get(`/resource-${index}/:id`, () => ({ok: true}));
    }
    app.get("/health", () => ({ok: true}));

    const request = {
        method: "GET",
        url: "/health",
        headers: new Headers(),
    };

    for (let index = 0; index < WARMUP; index++) {
        await app.handle(request, new BenchReply());
    }

    const samples: number[] = [];
    const started = performance.now();
    for (let index = 0; index < ITERATIONS; index++) {
        const before = performance.now();
        await app.handle(request, new BenchReply());
        samples.push(performance.now() - before);
    }
    const elapsed = performance.now() - started;

    return {
        mode,
        p50: percentile(samples, 0.5) * 1000,
        p95: percentile(samples, 0.95) * 1000,
        throughput: ITERATIONS / (elapsed / 1000),
    };
}

const results = [];
results.push(await measure("off"));
results.push(await measure("metrics"));
results.push(await measure("traces"));

const baseline = results[0].p50;
const withOverhead = results.map(result => ({
    ...result,
    overhead: baseline > 0 ? ((result.p50 - baseline) / baseline) * 100 : 0,
}));

console.log("# Raiton framework benchmark\n");
console.log("| Mode | p50 (µs) | p95 (µs) | Throughput (req/s) | Overhead p50 |");
console.log("|---|---:|---:|---:|---:|");
for (const result of withOverhead) {
    console.log(
        `| ${result.mode} | ${result.p50.toFixed(3)} | ${result.p95.toFixed(3)} | ` +
        `${Math.round(result.throughput)} | ${result.overhead.toFixed(2)} % |`
    );
}

if (process.argv.includes("--json")) {
    console.log("\n```json");
    console.log(JSON.stringify(withOverhead, null, 2));
    console.log("```");
}

const metricsBudget = withOverhead.find(result => result.mode === "metrics")!.overhead;
const tracesBudget = withOverhead.find(result => result.mode === "traces")!.overhead;

if (process.argv.includes("--check")) {
    if (metricsBudget > 5) {
        console.error(`metrics overhead exceeds 5 % p50: ${metricsBudget.toFixed(2)} %`);
        process.exitCode = 1;
    }
    if (tracesBudget > 10) {
        console.error(`traces overhead exceeds 10 % p50: ${tracesBudget.toFixed(2)} %`);
        process.exitCode = 1;
    }
}
