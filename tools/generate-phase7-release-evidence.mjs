import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

const STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", BLOCKED: "BLOCKED", NOT_RUN: "NOT_RUN" });
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const MIGRATION_PATTERN = /^\d+_[A-Za-z0-9_-]+\.sql$/;

function emit(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

function parseArgs(argv) {
  const options = { repoRoot: process.cwd(), expectedCommit: null, expectedBranch: null, expectedVersion: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repo-root" || argument === "--expected-commit" || argument === "--expected-branch" || argument === "--expected-version") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) return { error: "invalid-argument-value" };
      if (argument === "--repo-root") options.repoRoot = resolve(value);
      if (argument === "--expected-commit") options.expectedCommit = value;
      if (argument === "--expected-branch") options.expectedBranch = value;
      if (argument === "--expected-version") options.expectedVersion = value;
      index += 1;
      continue;
    }
    if (argument === "--help") return { help: true };
    return { error: "unsupported-argument" };
  }
  if (options.expectedCommit && !SHA_PATTERN.test(options.expectedCommit)) return { error: "invalid-expected-commit" };
  return options;
}

function git(repoRoot, args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function digest(lines) {
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

async function migrationEvidence(repoRoot, manifestPath) {
  const migrationDirectory = join(repoRoot, "supabase", "migrations");
  const entries = (await readdir(migrationDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  if (!entries.length || entries.some((name) => !MIGRATION_PATTERN.test(name))) throw new Error("migration-set-invalid");

  const localLines = [];
  for (const name of entries) {
    const contents = await readFile(join(migrationDirectory, name));
    localLines.push(`${name} ${createHash("sha256").update(contents).digest("hex")}`);
  }

  const manifestLines = (await readFile(join(repoRoot, manifestPath), "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (manifestLines.some((line) => !/^\S+\s+[0-9a-f]{64}$/i.test(line))) throw new Error("migration-manifest-invalid");

  const canonicalManifest = manifestLines
    .map((line) => line.split(/\s+/).join(" "))
    .sort();
  const canonicalLocal = [...localLines].sort();
  const localDigest = digest(canonicalLocal);
  const manifestDigest = digest(canonicalManifest);
  const matches = canonicalLocal.length === canonicalManifest.length && canonicalLocal.every((line, index) => line === canonicalManifest[index]);
  return {
    status: matches ? STATUS.PASS : STATUS.FAIL,
    count: entries.length,
    setDigest: localDigest,
    manifestDigest,
    matches,
    firstMigration: entries[0],
    lastMigration: entries.at(-1),
  };
}

function overallStatus(gates) {
  const statuses = Object.values(gates).map((gate) => gate.status);
  if (statuses.includes(STATUS.FAIL)) return STATUS.FAIL;
  if (statuses.includes(STATUS.BLOCKED)) return STATUS.BLOCKED;
  if (statuses.includes(STATUS.NOT_RUN)) return STATUS.NOT_RUN;
  return STATUS.PASS;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    emit({ tool: "phase7-release-identity", usage: "--repo-root <path> [--expected-commit <sha>] [--expected-branch <branch>] [--expected-version <version>]" });
    return;
  }
  if (options.error) {
    emit({ tool: "phase7-release-identity", status: STATUS.BLOCKED, blocker: options.error }, 1);
    return;
  }

  try {
    const repoRoot = resolve(options.repoRoot);
    const config = JSON.parse(await readFile(join(repoRoot, "config", "phase7-acceptance.json"), "utf8"));
    const packageMetadata = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
    const expectedRepository = config.releaseIdentity?.repository;
    const expectedBranch = options.expectedBranch ?? config.releaseIdentity?.approvedBranch;
    const manifestPath = config.releaseIdentity?.migrationManifest;
    if (typeof expectedRepository !== "string" || !expectedRepository || typeof expectedBranch !== "string" || !expectedBranch || typeof manifestPath !== "string" || !manifestPath) throw new Error("release-definition-incomplete");

    const gitRoot = git(repoRoot, ["rev-parse", "--show-toplevel"]);
    const branch = git(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const commit = git(repoRoot, ["rev-parse", "HEAD"]);
    const dirty = git(repoRoot, ["status", "--porcelain=v1", "--untracked-files=all"]).length > 0;
    const repositoryMatches = packageMetadata.name === expectedRepository && basename(gitRoot) === expectedRepository;
    const branchMatches = branch === expectedBranch;
    const versionMatchesFormat = typeof packageMetadata.version === "string" && VERSION_PATTERN.test(packageMetadata.version);
    const expectedVersionMatches = !options.expectedVersion || packageMetadata.version === options.expectedVersion;
    const versionValid = versionMatchesFormat && expectedVersionMatches;
    const commitMatches = !options.expectedCommit || commit.toLowerCase().startsWith(options.expectedCommit.toLowerCase());
    const migrations = await migrationEvidence(repoRoot, manifestPath);
    const releaseGate = {
      status: repositoryMatches && branchMatches && !dirty && versionValid ? STATUS.PASS : STATUS.FAIL,
      checks: {
        repositoryMatches,
        branchMatches,
        worktreeClean: !dirty,
        releaseVersionValid: versionValid,
      },
    };
    const deploymentIdentity = { status: STATUS.NOT_RUN, reason: "hosted-deployment-verification-is-separate" };
    const migrationGateStatus = migrations.status === STATUS.FAIL || (options.expectedCommit && !commitMatches)
      ? STATUS.FAIL
      : deploymentIdentity.status === STATUS.PASS
        ? STATUS.PASS
        : STATUS.NOT_RUN;
    const migrationGate = {
      status: migrationGateStatus,
      localCommitIdentity: { status: commitMatches ? STATUS.PASS : STATUS.FAIL, expectedCommitProvided: Boolean(options.expectedCommit) },
      migrationManifest: migrations,
      deploymentIdentity,
    };
    const evidence = {
      formatVersion: 1,
      tool: "phase7-release-identity",
      status: overallStatus({ "P7-REL-01": releaseGate, "P7-REL-02": migrationGate }),
      repository: { expected: expectedRepository, actual: packageMetadata.name, matches: repositoryMatches },
      git: { commitSha: commit, expectedCommitProvided: Boolean(options.expectedCommit), commitMatches, branch, expectedBranch, branchMatches },
      worktree: { clean: !dirty },
      releaseVersion: { source: "package.json", version: packageMetadata.version ?? null, expectedVersionProvided: Boolean(options.expectedVersion), valid: versionValid },
      migrationManifest: { path: manifestPath, ...migrations },
      gates: { "P7-REL-01": releaseGate, "P7-REL-02": migrationGate },
    };
    emit(evidence, evidence.status === STATUS.PASS ? 0 : 1);
  } catch (error) {
    const category = error?.message === "release-definition-incomplete" || error?.message === "migration-set-invalid" || error?.message === "migration-manifest-invalid" || error?.message === "ENOENT" ? error.message : "local-evidence-read-error";
    emit({ tool: "phase7-release-identity", status: STATUS.BLOCKED, blocker: category }, 1);
  }
}

main();
