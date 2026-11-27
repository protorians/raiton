import {afterAll, describe, expect, it} from "bun:test";
import {spawnSync} from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const REPO = path.resolve(import.meta.dir, "..");
const FIXTURE = path.join(import.meta.dir, "fixtures", "project");
const BIN = path.join(REPO, "source", "bin", "index.ts");

function run(args: string[], env: Record<string, string> = {}) {
    const result = spawnSync(process.execPath, [BIN, ...args], {
        cwd: FIXTURE,
        encoding: "utf-8",
        env: {...process.env, RAITON_DEBUG: "", ...env},
        timeout: 30_000,
    });
    return {
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
    };
}

describe("CLI de debug — call, explain, verify", () => {
    afterAll(() => {
        fs.rmSync(path.join(FIXTURE, ".raiton"), {recursive: true, force: true});
    });

    it("invoque une route et écrit un unique document JSON sur stdout", () => {
        const result = run(["call", "GET", "/items/:id", "--param", "id=42", "--json"]);
        expect(result.status).toBe(0);
        const payload = JSON.parse(result.stdout);
        expect(payload.schemaVersion).toBe("1.0.0");
        expect(payload.response.status).toBe(200);
        expect(payload.response.body).toEqual({id: 1, name: "Raiton"});
        expect(payload.response.requestId).toBeTruthy();
        expect(payload.contract.output).toBe("valid");
    });

    it("refuse une charge invalide avec le code de sortie 4", () => {
        const result = run(["call", "POST", "/items", "--data", '{"name":"x"}', "--json"]);
        expect(result.status).toBe(4);
        const payload = JSON.parse(result.stdout);
        expect(payload.contract.input).toBe("invalid");
        expect(payload.response.status).toBe(0);
        expect(payload.contract.issues[0].expected).toContain("minLength 2");
    });

    it("affiche la requête résolue en mode simulation", () => {
        const result = run(["call", "POST", "/items", "--example", "create", "--dry-run", "--json"]);
        expect(result.status).toBe(0);
        const payload = JSON.parse(result.stdout);
        expect(payload.request.dryRun).toBe(true);
        expect(payload.request.body).toEqual({name: "Raiton"});
        expect(payload.response.status).toBe(0);
    });

    it("explique un appel précédent via le journal de session borné", () => {
        const call = run(["call", "GET", "/items/:id", "--param", "id=7", "--json"]);
        expect(call.status).toBe(0);
        const requestId = JSON.parse(call.stdout).response.requestId;

        const explain = run(["explain", requestId, "--json"]);
        expect(explain.status).toBe(0);
        const payload = JSON.parse(explain.stdout);
        expect(payload.requestId).toBe(requestId);
        expect(payload.source.file).toContain("items.controller.ts");
        expect(payload.timeline.length).toBeGreaterThan(0);
        expect(payload.diagnosis.code).toBe("OK");
        expect(payload.nextActions.length).toBeGreaterThan(0);
    });

    it("rejoue une requête idempotente", () => {
        const call = run(["call", "GET", "/items/:id", "--param", "id=9", "--json"]);
        const first = JSON.parse(call.stdout);
        const replay = run(["call", "--replay", first.response.requestId, "--json"]);
        expect(replay.status).toBe(0);
        const payload = JSON.parse(replay.stdout);
        expect(payload.response.status).toBe(first.response.status);
        expect(payload.replayedFrom).toBe(first.response.requestId);
    });

    it("vérifie les contrats et retourne 0 quand tout passe", () => {
        const result = run(["verify", "--route", "/items", "--json"]);
        expect(result.status).toBe(0);
        const report = JSON.parse(result.stdout);
        expect(report.summary.routes).toBe(2);
        expect(report.summary.failed).toBe(0);
        expect(report.summary.skipped).toBe(1);
        expect(report.results.find((entry: any) => entry.method === "GET")?.passed).toBe(true);
    });

    it("retourne un code non nul et un JSON valide quand un contrat casse", () => {
        // The fixture output contract is valid; verify a filtered route that
        // cannot be resolved to force a deterministic failure.
        const result = run(["verify", "--route", "/items/:id", "--fail-on", "2xx", "--json"]);
        expect(result.status).toBe(4);
        const report = JSON.parse(result.stdout);
        expect(report.summary.failed).toBeGreaterThan(0);
    });
});
