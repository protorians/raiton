import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function getLatestTag() {
  try {
    return execSync("git describe --tags --abbrev=0").toString().trim();
  } catch {
    return null;
  }
}

function getCommitsSince(tag: string | null) {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  try {
    const output = execSync(`git log ${range} --format=%s`).toString().trim();
    return output ? output.split("\n") : [];
  } catch {
    return [];
  }
}

function determineIncrement(commits: string[]) {
  let increment: "major" | "minor" | "patch" | null = null;

  for (let commit of commits) {
    commit = commit.trim();
    if (
        commit.includes("BREAKING CHANGE") ||
        commit.includes("!") ||
        commit.toLowerCase().startsWith("release") ||
        commit.toLowerCase().startsWith("upgrade")
    ) {
      return "major";
    }
    if (
        commit.startsWith("feat") ||
        commit.startsWith("add")
    ) {
      increment = "minor";
    } else if (
        !increment &&
        commit.startsWith("fix") ||
        commit.startsWith("update") ||
        commit.toLowerCase().startsWith("remove")
    ) {
      increment = "patch";
    }
  }

  return increment;
}

function updateVersion(increment: "major" | "minor" | "patch") {
  const packageJsonPath = path.resolve(process.cwd(), "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const currentVersion = packageJson.version;
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  let nextVersion = "";
  if (increment === "major") {
    nextVersion = `${major + 1}.0.0`;
  } else if (increment === "minor") {
    nextVersion = `${major}.${minor + 1}.0`;
  } else {
    nextVersion = `${major}.${minor}.${patch + 1}`;
  }

  packageJson.version = nextVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
  console.log(`Version updated from ${currentVersion} to ${nextVersion}`);
  return nextVersion;
}

function main() {
  const latestTag = getLatestTag();
  console.log(`Latest tag: ${latestTag || "None"}`);

  const commits = getCommitsSince(latestTag);
  console.log(`Commits since last tag: ${commits.length}`);

  if (commits.length === 0) {
    console.log("No new commits. Skipping version update.");
    return;
  }

  const increment = determineIncrement(commits);
  if (!increment) {
    console.log("No version-triggering commits found (feat, fix, BREAKING CHANGE). Skipping version update.");
    return;
  }

  console.log(`Determined increment: ${increment}`);
  updateVersion(increment);
}

main();
