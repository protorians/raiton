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
  allowNonConventional: boolean;
  base?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const baseIndex = argv.indexOf("--base");
  const base = baseIndex !== -1 ? argv[baseIndex + 1] : undefined;
  return {
    dryRun: argv.includes("--dry-run"),
    json: argv.includes("--json"),
    // Par défaut, un commit non conventionnel fait échouer le script.
    // --allow-non-conventional restaure l'ancien comportement (ignorer silencieusement).
    allowNonConventional: argv.includes("--allow-non-conventional"),
    // Référence à utiliser comme base de comparaison au lieu de la branche amont (@{u}).
    // Utile en CI si aucun upstream n'est configuré : --base origin/main
    base,
    cwd: process.cwd(),
  };
}

function run(command: string): string {
  return execSync(command, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
}

function getUpstreamRef(): string | null {
  try {
    // Nom de la branche amont configurée, ex: "origin/main"
    return run("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
  } catch {
    return null; // pas d'upstream configuré (nouvelle branche jamais poussée)
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

function getCommitsInRange(range: string): CommitInfo[] {
  // %x00 / %x01 sont interprétés par git comme des octets littéraux dans la sortie.
  // On ne peut pas passer ces octets directement dans la commande (Node l'interdit :
  // "command must be a string without null bytes"), d'où l'usage des codes hexa git.
  const SEP = "\u0000";
  const END = "\u0001";
  try {
    const output = run(`git log ${range} --format=%s%x00%b%x01`);
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

interface UnpushedCommits {
  base: string | null;
  commits: CommitInfo[];
}

function getUnpushedCommits(baseOverride?: string): UnpushedCommits {
  const base = baseOverride || getUpstreamRef();
  if (!base) {
    return { base: null, commits: [] };
  }
  return { base, commits: getCommitsInRange(`${base}..HEAD`) };
}

// Format conventional commits : type(scope)!: description
const CONVENTIONAL_COMMIT_RE =
  /^(?<type>[a-zA-Z]+)(\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<description>.+)$/;

// Les commits de merge générés automatiquement par git ne sont pas soumis à la convention
const MERGE_COMMIT_RE = /^Merge (pull request|branch|remote-tracking branch)/i;

// Types qui déclenchent un incrément mais qui ne sont pas les seuls types valides :
// chore, docs, style, test, ci, build, perf(hors patch), etc. sont conventionnels
// mais ne provoquent volontairement aucun bump de version.
const MINOR_TYPES = new Set(["feat", "feature", "deprecate"]);
const PATCH_TYPES = new Set(["fix", "refactor", "perf", "remove", "revert"]);

function isConventional(commit: CommitInfo): boolean {
  if (MERGE_COMMIT_RE.test(commit.subject)) return true;
  return CONVENTIONAL_COMMIT_RE.test(commit.subject.trim());
}

interface ValidationResult {
  valid: CommitInfo[];
  invalid: CommitInfo[];
}

function validateCommits(commits: CommitInfo[]): ValidationResult {
  const valid: CommitInfo[] = [];
  const invalid: CommitInfo[] = [];
  for (const commit of commits) {
    (isConventional(commit) ? valid : invalid).push(commit);
  }
  return { valid, invalid };
}

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
    return null; // commit de merge ou non conventionnel (autorisé via --allow-non-conventional)
  }

  const { type, breaking } = match.groups;
  const normalizedType = type.toLowerCase();

  if (breaking === "!") return "major";
  if (MINOR_TYPES.has(normalizedType)) return "minor";
  if (PATCH_TYPES.has(normalizedType)) return "patch";

  return null; // type conventionnel valide (chore, docs...) mais sans impact sur la version
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

function logValidationError(options: CliOptions, invalid: CommitInfo[]) {
  if (options.json) {
    console.error(
      JSON.stringify(
        {
          status: "error",
          reason: "commits non conventionnels détectés",
          invalidCommits: invalid.map((c) => c.subject),
        },
        null,
        2
      )
    );
    return;
  }
  console.error("Erreur : certains commits ne respectent pas le format conventional commits.");
  console.error('Format attendu : "type(scope)!: description" (ex: "feat(auth): add login")');
  console.error("");
  for (const commit of invalid) {
    console.error(`  - ${commit.subject}`);
  }
  console.error("");
  console.error(
    "Corrige ces messages de commit (rebase interactif) ou relance avec --allow-non-conventional pour les ignorer."
  );
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
  console.log(`Base de comparaison : ${data.base ?? "aucune"}`);
  console.log(`Commits non poussés analysés : ${data.commitCount}`);
  console.log(`Increment déterminé : ${data.increment}`);
  const prefix = data.status === "dry-run" ? "[dry-run] " : "";
  console.log(
    `${prefix}Version : ${data.previousVersion} -> ${data.nextVersion} (branche: ${data.branch})`
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  const branch = getCurrentBranch();
  const { base, commits } = getUnpushedCommits(options.base);

  if (!base) {
    log(options, {
      base: null,
      commitCount: 0,
      branch,
      dryRun: options.dryRun,
      status: "skipped",
      reason:
        "aucune branche amont configurée (fais 'git push -u origin " +
        branch +
        "' une première fois, ou précise --base <ref>)",
    });
    return;
  }

  if (commits.length === 0) {
    log(options, {
      base,
      commitCount: 0,
      branch,
      dryRun: options.dryRun,
      status: "skipped",
      reason: `aucun commit non poussé par rapport à ${base}`,
    });
    return;
  }

  if (!options.allowNonConventional) {
    const { invalid } = validateCommits(commits);
    if (invalid.length > 0) {
      logValidationError(options, invalid);
      process.exitCode = 1;
      return;
    }
  }

  const increment = determineIncrement(commits);

  const summary = {
    base,
    commitCount: commits.length,
    increment,
    branch,
    dryRun: options.dryRun,
  };

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