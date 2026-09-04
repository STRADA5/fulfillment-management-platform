import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const toolPath = resolve("tools/generate-phase7-release-evidence.mjs");
const tempRoot = await mkdtemp(join(tmpdir(), "phase7-release-identity-"));
const fixtureRoot = join(tempRoot, "fulfillment-management-platform");

function git(args) {
  return execFileSync("git", args, { cwd: fixtureRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function runTool(args = []) {
  const result = spawnSync(process.execPath, [toolPath, "--repo-root", fixtureRoot, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  assert.equal(result.stderr, "", "release tool must not emit diagnostic details to stderr");
  return { code: result.status, payload: JSON.parse(result.stdout) };
}

function assertNoSensitiveOutput(payload) {
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /(?:sb_(?:publishable|secret)_|eyJ[A-Za-z0-9_-]{20,}|password\s*[:=]|access[_ -]?token\s*[:=]|cookie\s*[:=])/i);
}

try {
  await mkdir(join(fixtureRoot, "config"), { recursive: true });
  await mkdir(join(fixtureRoot, "supabase", "migrations"), { recursive: true });
  await writeFile(join(fixtureRoot, "package.json"), JSON.stringify({ name: "fulfillment-management-platform", version: "1.2.3" }));
  await writeFile(join(fixtureRoot, "config", "phase7-acceptance.json"), JSON.stringify({
    releaseIdentity: { repository: "fulfillment-management-platform", approvedBranch: "main", migrationManifest: "docs/migration-manifest.sha256" },
  }));
  await mkdir(join(fixtureRoot, "docs"), { recursive: true });
  await writeFile(join(fixtureRoot, "supabase", "migrations", "20260101010000_fixture.sql"), "select 1;\n");
  const migrationHash = execFileSync("git", ["hash-object", "supabase/migrations/20260101010000_fixture.sql"], { cwd: fixtureRoot, encoding: "utf8" }).trim();
  const crypto = await import("node:crypto");
  const contents = await readFile(join(fixtureRoot, "supabase", "migrations", "20260101010000_fixture.sql"));
  const sha256 = crypto.createHash("sha256").update(contents).digest("hex");
  assert.match(migrationHash, /^[0-9a-f]{40}$/);
  await writeFile(join(fixtureRoot, "docs", "migration-manifest.sha256"), `20260101010000_fixture.sql ${sha256}\n`);
  git(["init", "--initial-branch", "main"]);
  git(["config", "user.email", "phase7@example.test"]);
  git(["config", "user.name", "Phase 7 Test"]);
  git(["add", "."]);
  git(["commit", "-m", "fixture"]);
  const expectedCommit = git(["rev-parse", "HEAD"]);

  const success = runTool(["--expected-commit", expectedCommit, "--expected-version", "1.2.3"]);
  assert.equal(success.code, 1, "deployment identity NOT_RUN must fail closed");
  assert.equal(success.payload.status, "NOT_RUN", "deployment identity must remain NOT_RUN locally");
  assert.equal(success.payload.gates["P7-REL-01"].status, "PASS");
  assert.equal(success.payload.gates["P7-REL-02"].localCommitIdentity.status, "PASS");
  assert.equal(success.payload.gates["P7-REL-02"].migrationManifest.status, "PASS");
  assert.equal(success.payload.gates["P7-REL-02"].deploymentIdentity.status, "NOT_RUN");
  assert.equal(success.payload.migrationManifest.count, 1);
  assertNoSensitiveOutput(success.payload);

  const commitMismatch = runTool(["--expected-commit", "0000000"]);
  assert.equal(commitMismatch.code, 1);
  assert.equal(commitMismatch.payload.status, "FAIL");
  assert.equal(commitMismatch.payload.gates["P7-REL-02"].status, "FAIL");

  const branchMismatch = runTool(["--expected-commit", expectedCommit, "--expected-branch", "codex/unexpected-release"]);
  assert.equal(branchMismatch.payload.status, "FAIL");
  assert.equal(branchMismatch.payload.gates["P7-REL-01"].status, "FAIL");

  await writeFile(join(fixtureRoot, "untracked-phase7-change.txt"), "dirty");
  const dirty = runTool(["--expected-commit", expectedCommit]);
  assert.equal(dirty.payload.status, "FAIL");
  assert.equal(dirty.payload.gates["P7-REL-01"].checks.worktreeClean, false);
  await rm(join(fixtureRoot, "untracked-phase7-change.txt"), { force: true });

  const productionTarget = runTool(["--target-url", "https://fulfillment-management-platform.example"]);
  assert.equal(productionTarget.code, 1);
  assert.equal(productionTarget.payload.status, "BLOCKED");
  assert.equal(productionTarget.payload.blocker, "unsupported-argument");
  assertNoSensitiveOutput(productionTarget.payload);

  const source = await readFile(toolPath, "utf8");
  assert.doesNotMatch(source, /(?:node:(?:http|https)|\bfetch\s*\(|\baxios\b|\bundici\b)/i, "release evidence tool must have no network client");
  console.log("Phase 7 release identity evidence tests passed.");
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
