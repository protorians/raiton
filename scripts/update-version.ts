#!/usr/bin/env node
import {execSync} from "node:child_process";
import {readFileSync, writeFileSync, existsSync} from "node:fs";
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
    noTag: boolean;
    base?: string;
}

function parseArgs(argv: string[]): CliOptions {
    const baseIndex = argv.indexOf("--base");
    const base = baseIndex !== -1 ? argv[baseIndex + 1] : undefined;
    return {
        dryRun: argv.includes("--dry-run"),
        json: argv.includes("--json"),
        allowNonConventional: argv.includes("--allow-non-conventional"),
        noTag: argv.includes("--no-tag"),
        base,
        cwd: process.cwd(),
    };
}

function run(command: string): string {
    return execSync(command, {stdio: ["ignore", "pipe", "ignore"]}).toString().trim();
}

function getUpstreamRef(): string | null {
    try {
        return run("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
    } catch {
        return null;
    }
}

function getCurrentBranch(): string {
    try {
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
    hash: string;
    subject: string;
    body: string;
}

function getCommitsInRange(range: string): CommitInfo[] {
    const SEP = "\u0000";
    const END = "\u0001";
    try {
        const output = run(`git log ${range} --format=%H%x00%s%x00%b%x01`);
        if (!output) return [];
        return output
            .split(END)
            .map((entry) => entry.replace(/^\n/, "").trim())
            .filter(Boolean)
            .map((entry) => {
                const [hash, subject, body = ""] = entry.split(SEP);
                return {
                    hash: hash?.trim() || "",
                    subject: subject?.trim() || "",
                    body: body.trim(),
                };
            });
    } catch {
        return [];
    }
}

interface VersionRange {
    base: string | null;
    label: string | null;
    commits: CommitInfo[];
}

// Correspond aux tags de release de type "vX.Y.Z..." ou "vX.Y.Z-beta.N"...
const RELEASE_TAG_RE = /^v?\d+\.\d+\.\d+/;

function getLastReleaseTag(): string | null {
    try {
        // Tag le plus récent atteignable depuis HEAD
        const tag = run("git describe --tags --abbrev=0");
        return tag && RELEASE_TAG_RE.test(tag) ? tag : null;
    } catch {
        return null;
    }
}

function getRepoUrl(): string {
    try {
        const url = run("git config --get remote.origin.url");
        return url.replace(/\.git$/, "").trim();
    } catch {
        return "";
    }
}

function commitUrl(repoUrl: string, hash: string): string {
    if (!repoUrl) return `${hash.slice(0, 7)}`;
    return `[${hash.slice(0, 7)}](${repoUrl}/commit/${hash})`;
}

function getCommitsSinceTag(tag: string): CommitInfo[] {
    // Commit d'ancêtre commun le plus récent entre le tag et HEAD,
    // pour ne prendre que les commits réellement nouveaux depuis le tag.
    try {
        const mergeBase = run(`git merge-base "${tag}" HEAD`);
        return getCommitsInRange(`${mergeBase}..HEAD`);
    } catch {
        return getCommitsInRange(`${tag}..HEAD`);
    }
}

function getAllCommits(): CommitInfo[] {
    return getCommitsInRange("--root HEAD");
}

/**
 * Détection de la base de comparaison, par ordre de pertinence :
 *  1. --base explicite
 *  2. dernier tag de release atteignable (détermine réellement les nouveaux commits)
 *  3. branche amont (commits non poussés)
 *  4. historique complet (aucune base configurée)
 */
function getCommitsForVersion(
    baseOverride?: string
): VersionRange {
    if (baseOverride) {
        return {base: baseOverride, label: "base explicite (--base)", commits: getCommitsInRange(`${baseOverride}..HEAD`)};
    }

    const tag = getLastReleaseTag();
    if (tag) {
        return {base: tag, label: "dernier tag de release", commits: getCommitsSinceTag(tag)};
    }

    const upstream = getUpstreamRef();
    if (upstream) {
        return {base: upstream, label: "branche amont (commits non poussés)", commits: getCommitsInRange(`${upstream}..HEAD`)};
    }

    return {base: null, label: "historique complet", commits: getAllCommits()};
}

// @ts-ignore
const CONVENTIONAL_COMMIT_RE = /^(?<type>[a-zA-Z]+)(\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<description>.+)$/;

const MERGE_COMMIT_RE = /^Merge (pull request|branch|remote-tracking branch)/i;
const MINOR_TYPES = new Set(["feat", "feature", "deprecate"]);
const PATCH_TYPES = new Set(["fix", "refactor", "perf", "remove", "revert", "chore", "docs"]);

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
    return {valid, invalid};
}

function classifyCommit(commit: CommitInfo): Increment | null {
    const subject = commit.subject.trim();
    const body = commit.body.trim();
    const fullText = `${subject}\n${body}`;

    if (/^BREAKING[ -]CHANGE:/im.test(fullText)) {
        return "major";
    }

    const match = subject.match(CONVENTIONAL_COMMIT_RE);
    if (!match?.groups) {
        return null;
    }

    const {type, breaking} = match.groups;
    const normalizedType = type?.toLowerCase() || '';

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
        if (increment === "major") return "major";
        if (!result || INCREMENT_PRIORITY[increment] > INCREMENT_PRIORITY[result]) {
            result = increment;
        }
    }

    return result;
}

type ChangelogSection = "breaking" | "features" | "bugfixes" | "others";

function sectionForCommit(commit: CommitInfo): ChangelogSection {
    const subject = commit.subject.trim();
    const body = commit.body.trim();
    const fullText = `${subject}\n${body}`;

    if (/^BREAKING[ -]CHANGE:/im.test(fullText)) return "breaking";

    const match = subject.match(CONVENTIONAL_COMMIT_RE);
    const type = match?.groups?.type?.toLowerCase() ?? "";

    // un "!" dans le type (ex. feat!) marque aussi un breaking change
    if (type && subject.includes(`${type}!`)) return "breaking";
    if (MINOR_TYPES.has(type)) return "features";
    if (PATCH_TYPES.has(type)) return "bugfixes";

    return "others";
}

function renderCommitLine(commit: CommitInfo, repoUrl: string): string {
    return `* ${commit.subject} (${commitUrl(repoUrl, commit.hash)})`;
}

const SECTION_TITLES: Record<ChangelogSection, string> = {
    breaking: "Breaking Changes",
    features: "Features",
    bugfixes: "Bug Fixes",
    others: "Other Changes",
};

/**
 * Construit une section de CHANGELOG pour la version `next` à partir des commits
 * analysés, en imitant le format conventional-changelog existant.
 */
function renderChangelogSection(
    version: string,
    previousTag: string | null,
    commits: CommitInfo[],
    repoUrl: string
): string {
    const date = new Date().toISOString().slice(0, 10);
    const title = previousTag
        ? `## [${version}](${repoUrl}/compare/${previousTag}...v${version}) (${date})`
        : `# ${version} (${date})`;

    const sections: ChangelogSection[] = ["breaking", "features", "bugfixes", "others"];
    const lines: string[] = [title, ""];

    // La section breaking vient en premier et porte tous les commits classés
    // "other" restent en dernier.
    for (const section of sections) {
        const entries = commits.filter((c) => sectionForCommit(c) === section);
        if (entries.length === 0) continue;
        lines.push(`### ${SECTION_TITLES[section]}`, "");
        for (const commit of entries) {
            lines.push(renderCommitLine(commit, repoUrl));
        }
        lines.push("");
    }

    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
}

function writeChangelog(
    version: string,
    previousTag: string | null,
    commits: CommitInfo[],
    cwd: string
): void {
    const repoUrl = getRepoUrl();
    const changelogPath = path.resolve(cwd, "CHANGELOG.md");
    const section = renderChangelogSection(version, previousTag, commits, repoUrl);

    let existing = "";
    if (existsSync(changelogPath)) {
        existing = readFileSync(changelogPath, "utf-8").trim();
    }

    const newContent = existing ? `${section}\n\n${existing}\n` : `${section}\n`;
    writeFileSync(changelogPath, newContent);
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
    const parts = versionPart?.split(".").map((n) => {
        const parsed = Number(n);
        if (Number.isNaN(parsed)) {
            throw new Error(`Version invalide dans package.json : "${version}"`);
        }
        return parsed;
    }) || [];
    const [major = 0, minor = 0, patch = 0] = parts;

    let preReleaseType: string | null = null;
    let preReleaseNum: number | null = null;
    if (preReleasePart) {
        const m = preReleasePart.match(/^([a-zA-Z]+)\.?(\d+)?$/);
        if (m) {
            preReleaseType = m[1] || null;
            preReleaseNum = m[2] ? Number(m[2]) : 0;
        }
    }

    return {major, minor, patch, preReleaseType, preReleaseNum};
}

function detectBranchPreReleaseType(branch: string): string | null {
    const known = ["alpha", "beta", "rc"];
    return known.find((t) => branch.startsWith(t)) ?? null;
}

function computeNextVersion(current: string, increment: Increment, branch: string): string {
    const currentSemVer = parseSemVer(current);
    const {major, minor, patch} = currentSemVer;
    const branchPreType = detectBranchPreReleaseType(branch);

    let base: string;
    if (increment === "major") base = `${major + 1}.0.0`;
    else if (increment === "minor") base = `${major}.${minor + 1}.0`;
    else base = `${major}.${minor}.${patch + 1}`;

    if (!branchPreType) {
        return base;
    }

    const isSameCycle = currentSemVer.preReleaseType === branchPreType;
    const nextPreReleaseNum = isSameCycle ? (currentSemVer.preReleaseNum ?? -1) + 1 : 0;

    return `${base}-${branchPreType}.${nextPreReleaseNum}`;
}

function createVersionTag(version: string): boolean {
    const tag = `v${version}`;
    try {
        // Déjà présent (re-run) : on le déplace proprement sur HEAD.
        if (run(`git rev-parse -q --verify "refs/tags/${tag}"`)) {
            return false;
        }
    } catch {
        // le tag n'existe pas, on va le créer
    }
    run(`git tag "${tag}"`);
    return true;
}

function updateVersion(
    increment: Increment,
    branch: string,
    commits: CommitInfo[],
    previousTag: string | null,
    options: CliOptions
): { previous: string; next: string; tag: string | null; changelog: boolean } {
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

    let tag: string | null = null;
    let changelog = false;
    if (!options.dryRun) {
        packageJson.version = nextVersion;
        writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

        // Un tag accompagne toute nouvelle version : c'est la source de vérité
        // sur laquelle s'appuie la déduction (base = dernier tag).
        if (!options.noTag) {
            tag = `v${nextVersion}`;
            createVersionTag(nextVersion);
        }

        // Le CHANGELOG est synchronisé en parallèle avec la version.
        writeChangelog(nextVersion, previousTag, commits, options.cwd);
        changelog = true;
    }

    return {previous: currentVersion, next: nextVersion, tag, changelog};
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
    console.log(`Base de comparaison : ${data.base ?? "aucune"}${data.label ? ` (${data.label})` : ""}`);
    console.log(`Commits analysés : ${data.commitCount}`);
    console.log(`Increment déterminé : ${data.increment}`);
    const prefix = data.status === "dry-run" ? "[dry-run] " : "";
    console.log(
        `${prefix}Version : ${data.previousVersion} -> ${data.nextVersion} (branche: ${data.branch})`
    );
    if (data.tag) {
        console.log(`Tag créé : ${data.tag}`);
    }
    if (data.changelog) {
        console.log(`CHANGELOG.md synchronisé`);
    }
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    const branch = getCurrentBranch();
    const {base, label, commits} = getCommitsForVersion(options.base);

    if (commits.length === 0) {
        log(options, {
            base,
            label,
            commitCount: 0,
            branch,
            dryRun: options.dryRun,
            status: "skipped",
            reason: `aucun commit à analyser (base: ${base ?? "historique complet"})`,
        });
        return;
    }

    if (!options.allowNonConventional) {
        const {invalid} = validateCommits(commits);
        if (invalid.length > 0) {
            logValidationError(options, invalid);
            process.exitCode = 1;
            return;
        }
    }

    const increment = determineIncrement(commits);

    const summary = {
        base,
        label,
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

    const previousTag = (base && RELEASE_TAG_RE.test(base)) ? base : null;
    const {previous, next, tag, changelog} = updateVersion(
        increment,
        branch,
        commits,
        previousTag,
        options
    );

    log(options, {
        ...summary,
        status: options.dryRun ? "dry-run" : "updated",
        previousVersion: previous,
        nextVersion: next,
        tag,
        changelog,
    });
}

main();