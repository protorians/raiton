#!/usr/bin/env bun
/**
 * Benchmarks de la spec 003 — debug runtime assisté par IA.
 *
 * Le harnais mesure deux choses :
 *   1. le coût d'un journal de requêtes en mémoire (prototype de référence) ;
 *   2. l'économie de tokens des artefacts produits par les futures commandes
 *      (`call`, `explain`, `verify`) par rapport à un parcours manuel.
 *
 * Les mesures de performance sont réelles. Les économies de tokens sont des
 * projections explicitement marquées « Estimé » : elles comparent des tailles
 * d'artefacts mesurées à des sorties de référence représentatives.
 *
 * Exemples :
 *   bun run bench:ai
 *   bun run bench:ai --check
 *   bun run bench:ai --json --no-write
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {encode} from "gpt-tokenizer";
import {DebugJournal} from "../source/debug/journal.ts";
import type {DebugJournalEntry} from "../source/debug/types.ts";

const REPO = path.resolve(import.meta.dir, "..");
const FIXTURE = path.join(REPO, "tests/fixtures/project");
const CAPACITY = 1_000;
const WRITE_ITERATIONS = 200_000;
const LOOKUP_ITERATIONS = 50_000;
const SERIALIZE_ITERATIONS = 20_000;

interface Percentiles {
    p50: number;
    p90: number;
}

interface JournalRecord {
    requestId: string;
    method: string;
    route: string;
    status: number;
    durationMs: number;
    body: unknown;
    headers: Record<string, string>;
    issues: Array<{path: string; code: string; message: string}>;
}

function percentile(samples: number[], p: number): number {
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

function summarize(samples: number[]): Percentiles {
    return {p50: percentile(samples, 0.5), p90: percentile(samples, 0.9)};
}

function tokens(text: string): number {
    return encode(text).length;
}

function referenceRecord(index: number): JournalRecord {
    return {
        requestId: `req-${index.toString(16).padStart(12, "0")}`,
        method: "POST",
        route: "/api/users/:id",
        status: 400,
        durationMs: 3.21,
        body: {email: "ada@example.com", name: "Ada Lovelace", nested: {a: 1, b: [1, 2, 3]}},
        headers: {"content-type": "application/json", "user-agent": "bench"},
        issues: [{path: "/email", code: "format", message: "must be an email"}],
    };
}

/**
 * Prototype de référence : ring buffer borné, index par requestId et
 * sérialisation différée. Il ne s'agit pas de l'implémentation finale ; le
 * harnais vérifie que l'approche tient dans le budget avant intégration.
 */
function journalPrototype() {
    const ring: Array<JournalRecord | undefined> = new Array(CAPACITY);
    let head = 0;

    for (let index = 0; index < 10_000; index++) {
        ring[head] = referenceRecord(index);
        head = (head + 1) % CAPACITY;
    }

    const writeSamples: number[] = [];
    for (let index = 0; index < WRITE_ITERATIONS; index++) {
        const record = referenceRecord(index);
        const started = performance.now();
        ring[head] = record;
        head = (head + 1) % CAPACITY;
        writeSamples.push((performance.now() - started) * 1000);
    }

    for (let index = 0; index < CAPACITY; index++) ring[index] = referenceRecord(index);
    const target = ring[777]!;

    const linearSamples: number[] = [];
    for (let index = 0; index < LOOKUP_ITERATIONS; index++) {
        const started = performance.now();
        for (const record of ring) {
            if (record?.requestId === target.requestId) break;
        }
        linearSamples.push((performance.now() - started) * 1000);
    }

    const index_ = new Map(ring.map(record => [record!.requestId, record!]));
    const mapSamples: number[] = [];
    for (let index = 0; index < LOOKUP_ITERATIONS; index++) {
        const started = performance.now();
        index_.get(target.requestId);
        mapSamples.push((performance.now() - started) * 1000);
    }

    const serializeSamples: number[] = [];
    for (let index = 0; index < SERIALIZE_ITERATIONS; index++) {
        const started = performance.now();
        JSON.stringify(target);
        serializeSamples.push((performance.now() - started) * 1000);
    }

    return {
        capacity: CAPACITY,
        recordBytes: new TextEncoder().encode(JSON.stringify(target)).byteLength,
        write: summarize(writeSamples),
        linearLookup: summarize(linearSamples),
        mapLookup: summarize(mapSamples),
        serialize: summarize(serializeSamples),
    };
}

function realJournal(full = true) {
    const journal = new DebugJournal({capacity: CAPACITY, ttlMs: 900_000, maxTotalBytes: 8 * 1024 * 1024});
    const startedAt = new Date().toISOString();
    const record = (index: number): DebugJournalEntry => ({
        schemaVersion: "1.0.0",
        requestId: `req-${index.toString(16).padStart(12, "0")}`,
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        startedAt,
        request: {
            method: "POST",
            route: "/api/users/:id",
            pattern: "/users/:id",
            path: "/api/users/42",
            ...(full ? {
                query: {expand: "team"},
                headers: {"content-type": "application/json", authorization: "***"},
                body: {email: "ada@example.com", name: "Ada Lovelace"},
            } : {}),
        },
        response: {
            status: 400,
            durationMs: 3.21,
            ...(full ? {body: {error: true, code: "VALIDATION_ERROR"}} : {}),
        },
        source: {
            file: "source/controllers/users.controller.ts",
            line: 24,
            controller: "UsersController",
            handler: "create",
            decorator: '@Post("/")',
        },
        timeline: [
            {step: "middleware", durationMs: 0.08, result: "ok"},
            {step: "validation:input", durationMs: 0.31, result: "rejected"},
            {step: "handler", result: "not-executed"},
        ],
        validation: {
            ok: false,
            issues: [{path: "/email", code: "invalid_format", expected: "format:email", received: "ada@", message: "must be an email"}],
        },
        error: {code: "VALIDATION_ERROR", message: "Invalid request"},
        release: {hmr: false, buildId: "bench"},
    });

    for (let index = 0; index < CAPACITY; index++) journal.push(record(index), full ? undefined : 512);

    const writeSamples: number[] = [];
    for (let index = 0; index < WRITE_ITERATIONS; index++) {
        const record_ = record(index);
        const started = performance.now();
        journal.push(record_, full ? undefined : 512);
        writeSamples.push((performance.now() - started) * 1000);
    }

    const targetEntry = record(999_999);
    journal.push(targetEntry, full ? undefined : 512);
    const target = targetEntry.requestId;
    const mapSamples: number[] = [];
    for (let index = 0; index < LOOKUP_ITERATIONS; index++) {
        const started = performance.now();
        journal.get(target);
        mapSamples.push((performance.now() - started) * 1000);
    }

    const entry = journal.last()!;
    const serializeSamples: number[] = [];
    for (let index = 0; index < SERIALIZE_ITERATIONS; index++) {
        const started = performance.now();
        JSON.stringify(entry);
        serializeSamples.push((performance.now() - started) * 1000);
    }

    return {
        capacity: journal.capacity,
        size: journal.size,
        totalBytes: journal.totalBytes,
        recordBytes: new TextEncoder().encode(JSON.stringify(entry)).byteLength,
        write: summarize(writeSamples),
        mapLookup: summarize(mapSamples),
        serialize: summarize(serializeSamples),
    };
}

function runCli(args: string[], cwd: string): {ok: boolean; stdout: string; stderr: string} {
    const result = spawnSync("bun", [path.join(REPO, "source/bin/index.ts"), ...args], {
        cwd,
        encoding: "utf-8",
        timeout: 120_000,
    });
    return {ok: result.status === 0, stdout: result.stdout ?? "", stderr: result.stderr ?? ""};
}

function fileTokens(relative: string): {file: string; bytes: number; tokens: number} {
    const absolute = path.join(REPO, relative);
    const text = fs.readFileSync(absolute, "utf-8");
    return {file: relative, bytes: Buffer.byteLength(text), tokens: tokens(text)};
}

function artifactTokens() {
    const staticFiles = [
        fileTokens("docs/llms.txt"),
        fileTokens("docs/AGENTS.md"),
        fileTokens("README.md"),
        fileTokens("tests/fixtures/project/source/controllers/items.controller.ts"),
    ];

    const manifest = runCli(["inspect", "--json"], FIXTURE);
    const routes = runCli(["routes", "--json"], FIXTURE);

    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "raiton-bench-ai-"));
    const openapiFile = path.join(directory, "openapi.json");
    const openapi = runCli(["openapi", "export", "--out", openapiFile, "--force"], FIXTURE);
    const openapiTokens = openapi.ok && fs.existsSync(openapiFile)
        ? tokens(fs.readFileSync(openapiFile, "utf-8"))
        : 0;
    fs.rmSync(directory, {recursive: true, force: true});

    const samples = {
        explain: tokens(SAMPLE_EXPLAIN),
        call: tokens(SAMPLE_CALL),
        verify: tokens(SAMPLE_VERIFY),
        baselineLog: tokens(SAMPLE_BASELINE_LOG),
        curlResponse: tokens(SAMPLE_CURL_RESPONSE),
    };

    return {
        files: staticFiles,
        project: {
            manifest: manifest.ok ? tokens(manifest.stdout) : 0,
            routes: routes.ok ? tokens(routes.stdout) : 0,
            openapi: openapiTokens,
        },
        samples,
    };
}

/**
 * Scénarios de comparaison. Les valeurs de base sont des tailles d'artefacts
 * mesurées ; les sorties « avec feature » sont les échantillons ci-dessous.
 * Les hypothèses sont volontairement conservatrices : on ne compte pas les
 * gains de tours, de commandes ni de contexte système.
 */
function tokenProjections(artifacts: ReturnType<typeof artifactTokens>) {
    const tokens_ = artifacts.samples;
    const project = artifacts.project;
    // Contexte minimal déjà chargé par un agent au début d'une session.
    const fixedContext = artifacts.files[1].tokens;

    const scenarios = [
        {
            name: "Diagnostiquer un 400 de validation",
            baseline: artifacts.files[3].tokens + tokens_.baselineLog + project.routes,
            feature: tokens_.explain,
            assumptions: "Contrôleur (174) + extrait de logs (299) + routes (486) contre une explication structurée (408).",
        },
        {
            name: "Invoquer une route inconnue",
            baseline: artifacts.files[3].tokens + project.routes + tokens_.curlResponse,
            feature: tokens_.call,
            assumptions: "Contrôleur (174) + routes (486) + réponse curl (73) contre une invocation structurée (227).",
        },
        {
            name: "Invoquer une route connue (contexte chaud)",
            baseline: artifacts.files[3].tokens + tokens_.curlResponse,
            feature: tokens_.call,
            assumptions: "Contrôleur (174) + réponse curl (73) contre une invocation structurée (227) : borne basse réaliste.",
        },
        {
            name: "Vérifier les contrats après modification",
            baseline: project.openapi + artifacts.files[3].tokens,
            feature: tokens_.verify,
            assumptions: "OpenAPI (938) + contrôleur (174) contre un rapport de vérification compact (138).",
        },
    ].map(scenario => {
        const incremental = scenario.baseline > 0 ? (scenario.baseline - scenario.feature) / scenario.baseline : 0;
        const fresh = (scenario.baseline + fixedContext) > 0
            ? (scenario.baseline - scenario.feature) / (scenario.baseline + fixedContext)
            : 0;
        return {...scenario, incremental, fresh};
    });

    return {
        fixedContext,
        scenarios,
        medianIncremental: percentile(scenarios.map(scenario => scenario.incremental), 0.5),
        medianFresh: percentile(scenarios.map(scenario => scenario.fresh), 0.5),
    };
}

const SAMPLE_EXPLAIN = JSON.stringify({
    schemaVersion: "1.0.0",
    requestId: "req-0000000001a2",
    request: {
        method: "POST",
        route: "/api/users",
        pattern: "/users",
        status: 400,
        durationMs: 2.41,
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    },
    source: {
        file: "source/controllers/users.controller.ts",
        line: 24,
        controller: "UsersController",
        handler: "create",
        decorator: "@Post(\"/\")",
    },
    timeline: [
        {step: "middleware:cors", durationMs: 0.08},
        {step: "middleware:auth", durationMs: 0.22, result: "ok"},
        {step: "validation:input", durationMs: 0.31, result: "rejected"},
        {step: "handler", result: "not-executed"},
    ],
    diagnosis: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        issues: [{path: "/email", code: "format", expected: "email", received: "ada@", message: "must be an email"}],
        hint: "The handler was not executed; fix the email field or relax the contract.",
    },
    nextActions: [
        "raiton why POST /api/users",
        "raiton call POST /api/users --data '{\"email\":\"ada@example.com\"}'",
        "raiton inspect --json",
    ],
}, null, 2);

const SAMPLE_CALL = JSON.stringify({
    schemaVersion: "1.0.0",
    request: {
        method: "POST",
        path: "/api/users",
        headers: {"content-type": "application/json", authorization: "Bearer ***"},
        body: {email: "ada@example.com", name: "Ada Lovelace"},
    },
    response: {
        status: 201,
        durationMs: 4.12,
        requestId: "req-0000000001ac",
        traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
        body: {id: 42, email: "ada@example.com", name: "Ada Lovelace"},
    },
    contract: {input: "valid", output: "valid"},
    nextActions: ["raiton explain req-0000000001ac"],
}, null, 2);

const SAMPLE_VERIFY = JSON.stringify({
    schemaVersion: "1.0.0",
    summary: {routes: 2, passed: 1, failed: 1, durationMs: 18},
    failures: [{
        method: "POST",
        path: "/api/items",
        code: "OUTPUT_VALIDATION_ERROR",
        issue: "/id expected integer",
        source: "source/controllers/items.controller.ts:24",
    }],
    nextActions: ["raiton call POST /api/items --data '{\"name\":\"Raiton\"}'"],
}, null, 2);

const SAMPLE_BASELINE_LOG = [
    "[2026-11-27T18:05:50.941Z] INFO POST /api/users request_id=req-0000000001a2",
    "[2026-11-27T18:05:50.941Z] INFO POST /api/users/42 request_id=req-0000000001a3",
    "[2026-11-27T18:05:50.942Z] INFO GET /api/users request_id=req-0000000001a4",
    "[2026-11-27T18:05:50.943Z] WARN [contract] POST /users rejected request request_id=req-0000000001a2",
    "[2026-11-27T18:05:50.943Z] ERROR Failed to execute UsersController.create handler request_id=req-0000000001a6",
    "Error: Invalid request",
    "    at UsersController.create (/app/source/controllers/users.controller.ts:24:18)",
    "    at async createHandler (/app/source/core/router/handler.ts:88:31)",
    "    at async Router.resolve (/app/source/core/router/router.ts:64:22)",
    "[2026-11-27T18:05:50.944Z] INFO POST /api/users request_id=req-0000000001a7",
    "[2026-11-27T18:05:50.945Z] WARN [contract] POST /users rejected request request_id=req-0000000001aa",
].join("\n");

const SAMPLE_CURL_RESPONSE = JSON.stringify({
    status: 201,
    headers: {"content-type": "application/json", "x-request-id": "req-0000000001ac"},
    body: {id: 42, email: "ada@example.com", name: "Ada Lovelace"},
}, null, 2);

function formatTable(title: string, rows: string[][], headers: string[]): string {
    return [
        `### ${title}`,
        "",
        `| ${headers.join(" | ")} |`,
        `| ${headers.map(() => "---").join(" | ")} |`,
        ...rows.map(row => `| ${row.join(" | ")} |`),
    ].join("\n");
}

function main() {
    const journal = journalPrototype();
    const real = realJournal(true);
    const realMetadata = realJournal(false);
    const artifacts = artifactTokens();
    const projections = tokenProjections(artifacts);

    let referenceHttpP50 = 0;
    const latest = path.join(REPO, "benchmarks/latest.json");
    if (fs.existsSync(latest)) {
        try {
            const report = JSON.parse(fs.readFileSync(latest, "utf-8"));
            referenceHttpP50 = Number(report?.http?.threeHundredLast?.p50 ?? 0);
        } catch {
            referenceHttpP50 = 0;
        }
    }

    const writeOverhead = referenceHttpP50 > 0 ? journal.write.p50 / referenceHttpP50 : 0;
    const fullOverhead = referenceHttpP50 > 0
        ? (journal.write.p50 + journal.serialize.p50) / referenceHttpP50
        : 0;

    const report = {
        generatedAt: new Date().toISOString(),
        environment: {
            runtime: `Bun ${Bun.version}`,
            node: process.version,
            platform: `${process.platform}-${process.arch}`,
            cpus: os.cpus().length,
        },
        journal,
        realJournal: real,
        realMetadataJournal: realMetadata,
        referenceHttpP50,
        overhead: {write: writeOverhead, full: fullOverhead},
        artifacts,
        projections,
    };

    const markdown = [
        "# Raiton AI debug benchmark",
        "",
        `Généré le ${report.generatedAt} · Bun ${Bun.version} · ${report.environment.platform}`,
        "",
        "Ce rapport couvre la spec 003. Les mesures de performance sont réelles ;",
        "les économies de tokens sont des projections marquées « Estimé ».",
        "",
        formatTable("Journal de requêtes — implémentation réelle (µs / opération)", [
            ["Métadonnées — écriture", realMetadata.write.p50.toFixed(3), realMetadata.write.p90.toFixed(3), `${realMetadata.recordBytes} o`],
            ["Métadonnées — recherche indexée", realMetadata.mapLookup.p50.toFixed(3), realMetadata.mapLookup.p90.toFixed(3), ""],
            ["Complet — écriture", real.write.p50.toFixed(3), real.write.p90.toFixed(3), `${real.recordBytes} o`],
            ["Complet — recherche indexée", real.mapLookup.p50.toFixed(3), real.mapLookup.p90.toFixed(3), ""],
            ["Sérialisation d'une entrée complète", real.serialize.p50.toFixed(3), real.serialize.p90.toFixed(3), ""],
            ["Mémoire (1 000 entrées, complètes)", `${(real.totalBytes / 1024).toFixed(0)} Kio`, "", `≤ 8 Mio`],
        ], ["Opération", "p50", "p90", "Taille"]),
        "",
        formatTable("Journal de requêtes — prototype (µs / opération)", [
            ["Écriture ring buffer", journal.write.p50.toFixed(3), journal.write.p90.toFixed(3), `${journal.recordBytes} o`],
            ["Recherche linéaire (1 000 entrées)", journal.linearLookup.p50.toFixed(3), journal.linearLookup.p90.toFixed(3), ""],
            ["Recherche indexée (Map)", journal.mapLookup.p50.toFixed(3), journal.mapLookup.p90.toFixed(3), ""],
            ["Sérialisation d'un enregistrement", journal.serialize.p50.toFixed(3), journal.serialize.p90.toFixed(3), ""],
        ], ["Opération", "p50", "p90", "Taille"]),
        "",
        referenceHttpP50 > 0
            ? `Référence pile HTTP (spec 001) : **${referenceHttpP50.toFixed(3)} µs** p50. ` +
            `Surcoût capture métadonnées : **${(writeOverhead * 100).toFixed(2)} %** ; ` +
            `capture + sérialisation immédiate : **${(fullOverhead * 100).toFixed(2)} %**.`
            : "Référence pile HTTP indisponible : exécuter `bun run bench` d'abord.",
        "",
        formatTable("Artefacts — tokens mesurés (cl100k_base)", [
            ...artifacts.files.map(file => [file.file, String(file.bytes), String(file.tokens)]),
            ["manifeste du projet fixture", "", String(artifacts.project.manifest)],
            ["routes du projet fixture", "", String(artifacts.project.routes)],
            ["OpenAPI du projet fixture", "", String(artifacts.project.openapi)],
            ["sortie explain (échantillon)", "", String(artifacts.samples.explain)],
            ["sortie call (échantillon)", "", String(artifacts.samples.call)],
            ["rapport verify (échantillon)", "", String(artifacts.samples.verify)],
            ["extrait de logs (échantillon)", "", String(artifacts.samples.baselineLog)],
            ["réponse curl (échantillon)", "", String(artifacts.samples.curlResponse)],
        ], ["Artefact", "Octets", "Tokens"]),
        "",
        formatTable("Économie de tokens par scénario (Estimé)", [
            ...projections.scenarios.map(scenario => [
                scenario.name,
                String(Math.round(scenario.baseline)),
                String(Math.round(scenario.feature)),
                `${(scenario.incremental * 100).toFixed(1)} %`,
                `${(scenario.fresh * 100).toFixed(1)} %`,
            ]),
            ["Médiane", "", "", `${(projections.medianIncremental * 100).toFixed(1)} %`, `${(projections.medianFresh * 100).toFixed(1)} %`],
        ], ["Scénario", "Sans feature", "Avec feature", "Économie incrémentale", "Économie session neuve"]),
        "",
        `Contexte fixe retenu pour la session neuve : **${projections.fixedContext} tokens** (AGENTS.md seul).`,
        "",
        "Hypothèses :",
        ...projections.scenarios.map(scenario => `- **${scenario.name}** : ${scenario.assumptions}`),
        "",
    ].join("\n");

    console.log(markdown);

    const outDir = process.argv.includes("--out")
        ? path.resolve(process.argv[process.argv.indexOf("--out") + 1])
        : path.join(REPO, "benchmarks");
    if (!process.argv.includes("--no-write")) {
        fs.mkdirSync(outDir, {recursive: true});
        fs.writeFileSync(path.join(outDir, "ai-debug.md"), markdown + "\n", "utf-8");
        fs.writeFileSync(path.join(outDir, "ai-debug.json"), JSON.stringify(report, null, 2) + "\n", "utf-8");
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

        // Budgets de la spec 003, annexe metrics.
        check("écriture journal (p50)", journal.write.p50, Number(process.env.BENCH_AI_JOURNAL_WRITE_US ?? 0.5), " µs");
        check("recherche indexée (p50)", journal.mapLookup.p50, Number(process.env.BENCH_AI_LOOKUP_US ?? 1), " µs");
        check("sérialisation explain (p50)", journal.serialize.p50, Number(process.env.BENCH_AI_SERIALIZE_US ?? 2), " µs");
        check("écriture journal réel complet (p50)", real.write.p50, Number(process.env.BENCH_AI_REAL_WRITE_FULL_US ?? 1.5), " µs");
        check("écriture journal réel métadonnées (p50)", realMetadata.write.p50, Number(process.env.BENCH_AI_REAL_WRITE_US ?? 0.5), " µs");
        check("recherche indexée réelle (p50)", real.mapLookup.p50, Number(process.env.BENCH_AI_REAL_LOOKUP_US ?? 1), " µs");
        check("sérialisation réelle (p50)", real.serialize.p50, Number(process.env.BENCH_AI_REAL_SERIALIZE_US ?? 2), " µs");
        if (real.totalBytes > 8 * 1024 * 1024) {
            failures.push(`mémoire journal: ${(real.totalBytes / 1024 / 1024).toFixed(2)} Mio > 8 Mio`);
        }
        if (projections.medianFresh < 0.4) {
            failures.push(`économie médiane de tokens (session neuve): ${(projections.medianFresh * 100).toFixed(1)} % < 40 % (projection)`);
        }

        if (failures.length) {
            console.error("\nBudgets IA dépassés :");
            for (const failure of failures) console.error(` - ${failure}`);
            process.exitCode = 1;
        } else {
            console.log("\nBudgets spec 003 respectés (projections incluses).");
        }
    }
}

main();
