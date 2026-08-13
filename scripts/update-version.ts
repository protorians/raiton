#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

type Increment = "major" | "minor" | "patch";

const INCREMENT_PRIORITY: Record<Increment, number> = {
  patch: 1,
  minor: 2,
  major: 3,
};

interface CliOptions {
  dryRun: boolean;
  json: boolean;
  cwd: string;
}

function parseArgs(argv: string[]): CliOptions {
  return {
    dryRun: argv.includes("--dry-run"),
    json: argv.includes("--json"),
    cwd: process.cwd(),
  };
}

function run(command: string): string {
  return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}

function getLatestTag(): string | null {
  try {
    return run("git describe --tags --abbrev=0");
  } catch {
    return null;
  }
}

function getCurrentBranch(): string {
  try {
    // En CI, HEAD est souvent détaché : on privilégie les variables d'environnement usuelles
    return (
      process.env.CI_BRANCH ||
      process.env.GITHUB_REF_NAME ||
      run("git rev-parse --abbrev-ref HEAD")
    );
  } catch {
    return "main";
  }
}

interface CommitInfo {
  subject: string;
  body: string;
}

function getCommitsSince(tag: string | null): CommitInfo[] {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const SEP = "\u0000"; // séparateur improbable dans un message de commit
  const END = "\u0001";
  try {
    const output = run(`git log ${range} --format=%s${SEP}%b${END}`);
    if (!output) return [];
    return output
      .split(END)
      .map((entry) => entry.replace(/^\n/, "").trim())
      .filter(Boolean)
      .map((entry) => {
        const [subject, body = ""] = entry.split(SEP);
        return { subject: subject.trim(), body: body.trim() };
      });
  } catch {
    return [];
  }
}

// Format conventional commits : type(scope)!: description
const CONVENTIONAL_COMMIT_RE =
  /^(?<type>[a-zA-Z]+)(\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<description>.+)$/;

const MINOR_TYPES = new Set(["feat", "feature", "deprecate"]);
const PATCH_TYPES = new Set(["fix", "refactor", "perf", "remove", "revert"]);

function classifyCommit(commit: CommitInfo): Increment | null {
  const subject = commit.subject.trim();
  const body = commit.body.trim();
  const fullText = `${subject}\n${body}`;

  // 1. Breaking change explicite (footer "BREAKING CHANGE:") -> toujours majeur
  if (/^BREAKING[ -]CHANGE:/im.test(fullText)) {
    return "major";
  }

  const match = subject.match(CONVENTIONAL_COMMIT_RE);
  if (!match?.groups) {
    return null; // commit non conventionnel (chore, docs, wip...) : ignoré
  }

  const { type, breaking } = match.groups;
  const normalizedType = type.toLowerCase();

  if (breaking === "!") return "major";
  if (MINOR_TYPES.has(normalizedType)) return "minor";
  if (PATCH_TYPES.has(normalizedType)) return "patch";

  return null;
}

function determineIncrement(commits: CommitInfo[]): Increment | null {
  let result: Increment | null = null;

  for (const commit of commits) {
    const increment = classifyCommit(commit);
    if (!increment) continue;
    if (increment === "major") return "major"; // rien de plus fort, court-circuit
    if (!result || INCREMENT_PRIORITY[increment] > INCREMENT_PRIORITY[result]) {
      result = increment;
    }
  }

  return result;
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
  preReleaseType: string | null;
  preReleaseNum: number | null;
}

function parseSemVer(version: string): SemVer {
  const [versionPart, ...preReleaseParts] = version.split("-");
  const preReleasePart = preReleaseParts.join("-"); // gère les suffixes contenant des "-"
  const parts = versionPart.split(".").map((n) => {
    const parsed = Number(n);
    if (Number.isNaN(parsed)) {
      throw new Error(`Version invalide dans package.json : "${version}"`);
    }
    return parsed;
  });
  const [major, minor, patch] = parts;

  let preReleaseType: string | null = null;
  let preReleaseNum: number | null = null;
  if (preReleasePart) {
    const m = preReleasePart.match(/^([a-zA-Z]+)\.?(\d+)?$/);
    if (m) {
      preReleaseType = m[1];
      preReleaseNum = m[2] ? Number(m[2]) : 0;
    }
  }

  return { major, minor, patch, preReleaseType, preReleaseNum };
}

function detectBranchPreReleaseType(branch: string): string | null {
  const known = ["alpha", "beta", "rc"];
  return known.find((t) => branch.startsWith(t)) ?? null;
}

function computeNextVersion(current: string, increment: Increment, branch: string): string {
  const currentSemVer = parseSemVer(current);
  const { major, minor, patch } = currentSemVer;
  const branchPreType = detectBranchPreReleaseType(branch);

  let base: string;
  if (increment === "major") base = `${major + 1}.0.0`;
  else if (increment === "minor") base = `${major}.${minor + 1}.0`;
  else base = `${major}.${minor}.${patch + 1}`;

  if (!branchPreType) {
    return base; // release stable : on abandonne tout suffixe de pre-release
  }

  // Nouveau cycle de pre-release si le type change (ex: beta -> rc) ou si c'est le premier
  const isSameCycle = currentSemVer.preReleaseType === branchPreType;
  const nextPreReleaseNum = isSameCycle ? (currentSemVer.preReleaseNum ?? -1) + 1 : 0;

  return `${base}-${branchPreType}.${nextPreReleaseNum}`;
}

function updateVersion(
  increment: Increment,
  branch: string,
  options: CliOptions
): { previous: string; next: string } {
  const packageJsonPath = path.resolve(options.cwd, "package.json");
  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json introuvable à l'emplacement : ${packageJsonPath}`);
  }

  const raw = readFileSync(packageJsonPath, "utf-8");
  const packageJson = JSON.parse(raw);
  const currentVersion: string = packageJson.version;
  if (!currentVersion) {
    throw new Error('Le champ "version" est manquant dans package.json');
  }

  const nextVersion = computeNextVersion(currentVersion, increment, branch);

  if (!options.dryRun) {
    packageJson.version = nextVersion;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  }

  return { previous: currentVersion, next: nextVersion };
}

function log(options: CliOptions, data: Record<string, unknown>) {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (data.status === "skipped") {
    console.log(`Aucune mise à jour : ${data.reason}`);
    return;
  }
  console.log(`Tag le plus récent : ${data.latestTag ?? "aucun"}`);
  console.log(`Commits analysés : ${data.commitCount}`);
  console.log(`Increment déterminé : ${data.increment}`);
  const prefix = data.status === "dry-run" ? "[dry-run] " : "";
  console.log(
    `${prefix}Version : ${data.previousVersion} -> ${data.nextVersion} (branche: ${data.branch})`
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  const latestTag = getLatestTag();
  const commits = getCommitsSince(latestTag);
  const increment = determineIncrement(commits);
  const branch = getCurrentBranch();

  const summary = {
    latestTag,
    commitCount: commits.length,
    increment,
    branch,
    dryRun: options.dryRun,
  };

  if (commits.length === 0) {
    log(options, { ...summary, status: "skipped", reason: "aucun nouveau commit" });
    return;
  }

  if (!increment) {
    log(options, {
      ...summary,
      status: "skipped",
      reason: "aucun commit ne déclenche de version (feat, fix, BREAKING CHANGE...)",
    });
    return;
  }

  const { previous, next } = updateVersion(increment, branch, options);

  log(options, {
    ...summary,
    status: options.dryRun ? "dry-run" : "updated",
    previousVersion: previous,
    nextVersion: next,
  });
}

main();