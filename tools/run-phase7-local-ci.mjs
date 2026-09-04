import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", BLOCKED: "BLOCKED", NOT_RUN: "NOT_RUN" });

const REQUIRED_GATES = Object.freeze([
  "typecheck",
  "lint",
  "productionBuild",
  "securityRegression",
  "phase6Authorization",
  "phase7ReleaseIdentity",
  "phase7Acceptance",
  "phase7MigrationRecovery",
  "secretScan",
  "artifactIdentity",
]);
const NETWORK_PATTERN = /(?:node:(?:http|https)|\bfetch\s*\(|\baxios\b|\bundici\b|https?:\/\/)/i;
const SECRET_PATTERNS = [
  /sb_(?:publishable|secret)_[A-Za-z0-9]{10,}/i,
  /(?:eyJ[A-Za-z0-9_-]{20,}\.){2}[A-Za-z0-9_-]{10,}/,
  /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PRIVATE) KEY-----/i,
  /(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|VERCEL_AUTOMATION_BYPASS_SECRET)\s*=\s*["']?(?!(?:REPLACE_WITH_|YOUR_|CHANGE_ME|CHANGEME|EXAMPLE|DUMMY|TEST_))[A-Za-z0-9_+/=-]{20,}["']?/i,
];

export function overallStatus(gates) {
  const statuses = Object.values(gates).map((gate) => gate.status);
  if (statuses.includes(STATUS.FAIL)) return STATUS.FAIL;
  if (statuses.includes(STATUS.BLOCKED)) return STATUS.BLOCKED;
  if (statuses.includes(STATUS.NOT_RUN)) return STATUS.NOT_RUN;
  return STATUS.PASS;
}

export function isOverallPass(gates) {
  return REQUIRED_GATES.every((gateId) => gates[gateId]?.status === STATUS.PASS);
}

export function parseArgs(argv) {
  const options = { repoRoot: process.cwd(), expectedCommit: null, expectedBranch: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repo-root" || argument === "--expected-commit" || argument === "--expected-branch") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) return { error: "invalid-argument-value" };
      if (argument === "--repo-root") options.repoRoot = resolve(value);
      if (argument === "--expected-commit") options.expectedCommit = value;
      if (argument === "--expected-branch") options.expectedBranch = value;
      index += 1;
      continue;
    }
    if (argument === "--help") return { help: true };
    return { error: "unsupported-argument" };
  }
  return options;
}

function safeCommandError(error) {
  if (error?.code === "ENOENT") return "command-not-found";
  if (error?.code === "EACCES") return "command-not-permitted";
  return "local-command-spawn-error";
}

function fixtureFailure(output) {
  return /(?:duplicate key value|unique constraint|already exists|fixture(?:s)? may remain|stale.*fixture)/i.test(output);
}

export function runLocalCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    // Gate output is intentionally discarded: it may contain fixture details or credentials,
    // and piping verbose suites without draining would deadlock the synchronous child.
    stdio: ["ignore", "ignore", "ignore"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  if (result.error) return { status: STATUS.BLOCKED, reason: safeCommandError(result.error) };
  if (result.status === 0) return { status: STATUS.PASS, reason: "command-exited-zero", exitCode: 0 };
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  return {
    status: fixtureFailure(output) ? STATUS.BLOCKED : STATUS.FAIL,
    reason: fixtureFailure(output) ? "stale-test-fixture" : "command-exited-nonzero",
    exitCode: typeof result.status === "number" ? result.status : 1,
  };
}

function runNpmScript(script, repoRoot) {
  if (process.platform === "win32") return runLocalCommand("cmd.exe", ["/d", "/s", "/c", "npm.cmd", "run", script], repoRoot);
  return runLocalCommand("npm", ["run", script], repoRoot);
}

function parseJsonOutput(result) {
  if (result.error || typeof result.stdout !== "string") return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

export function releaseIdentityGateFromEvidence(payload) {
  const release = payload?.gates?.["P7-REL-01"];
  const localCommit = payload?.gates?.["P7-REL-02"]?.localCommitIdentity;
  const manifest = payload?.gates?.["P7-REL-02"]?.migrationManifest;
  if (!release || !localCommit || !manifest) return { status: STATUS.BLOCKED, reason: "release-evidence-invalid" };
  if (release.status !== STATUS.PASS) return { status: STATUS.FAIL, reason: "release-identity-mismatch", releaseGate: release.status };
  if (localCommit.status !== STATUS.PASS) return { status: STATUS.FAIL, reason: "commit-identity-mismatch", commitGate: localCommit.status };
  if (manifest.status !== STATUS.PASS) return { status: STATUS.FAIL, reason: "migration-manifest-mismatch", manifestGate: manifest.status };
  return {
    status: STATUS.PASS,
    reason: "local-release-identity-validated",
    deploymentIdentity: payload?.gates?.["P7-REL-02"]?.deploymentIdentity?.status ?? STATUS.NOT_RUN,
  };
}

function runReleaseIdentity(repoRoot, expectedCommit, expectedBranch) {
  const toolPath = resolve(repoRoot, "tools", "generate-phase7-release-evidence.mjs");
  const args = [toolPath, "--repo-root", repoRoot, "--expected-branch", expectedBranch];
  if (expectedCommit) args.push("--expected-commit", expectedCommit);
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  if (result.error) return { status: STATUS.BLOCKED, reason: safeCommandError(result.error) };
  const payload = parseJsonOutput(result);
  if (!payload) return { status: STATUS.BLOCKED, reason: "release-evidence-unreadable" };
  return { ...releaseIdentityGateFromEvidence(payload), expectedCommitProvided: Boolean(expectedCommit) };
}

async function trackedCandidateFiles(repoRoot) {
  const run = (args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const tracked = run(["ls-files"]).split(/\r?\n/).filter(Boolean);
  const untracked = run(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/).filter(Boolean);
  return [...new Set([...tracked, ...untracked])]
    .filter((file) => !/^(?:node_modules|\.next|\.git|coverage|dist)(?:[\\/]|$)/i.test(file))
    .map((file) => resolve(repoRoot, file));
}

export function scanTextForSecrets(text) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

async function secretScan(repoRoot) {
  let files;
  try {
    files = await trackedCandidateFiles(repoRoot);
  } catch {
    return { status: STATUS.BLOCKED, reason: "candidate-file-list-unavailable" };
  }
  for (const file of files) {
    try {
      const contents = await readFile(file);
      if (contents.includes(0)) continue;
      if (scanTextForSecrets(contents.toString("utf8"))) return { status: STATUS.FAIL, reason: "secret-like-value-detected" };
    } catch {
      return { status: STATUS.BLOCKED, reason: "candidate-file-read-error" };
    }
  }
  return { status: STATUS.PASS, reason: "no-secret-like-values-detected", filesScanned: files.length };
}

async function artifactIdentity(repoRoot) {
  const buildIdPath = join(repoRoot, ".next", "BUILD_ID");
  try {
    const buildId = (await readFile(buildIdPath, "utf8")).trim();
    if (!buildId || NETWORK_PATTERN.test(buildId)) return { status: STATUS.FAIL, reason: "build-artifact-identity-invalid" };
    return {
      status: STATUS.PASS,
      reason: "build-artifact-identity-recorded",
      buildIdDigest: createHash("sha256").update(buildId, "utf8").digest("hex"),
      buildIdLength: buildId.length,
    };
  } catch {
    return { status: STATUS.FAIL, reason: "build-artifact-missing" };
  }
}

async function readDefinition(repoRoot) {
  return JSON.parse(await readFile(join(repoRoot, "config", "phase7-acceptance.json"), "utf8"));
}

function emit(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

export async function buildEvidence(options) {
  const config = await readDefinition(options.repoRoot);
  const expectedBranch = options.expectedBranch ?? config.releaseIdentity?.approvedBranch;
  const results = {};
  results.phase7ReleaseIdentity = runReleaseIdentity(options.repoRoot, options.expectedCommit, expectedBranch);
  results.typecheck = runNpmScript("typecheck", options.repoRoot);
  results.lint = runNpmScript("lint", options.repoRoot);
  results.productionBuild = runNpmScript("build", options.repoRoot);
  results.securityRegression = runNpmScript("test:security:local", options.repoRoot);
  results.phase6Authorization = runNpmScript("test:auth:phase6", options.repoRoot);
  results.phase7Acceptance = runNpmScript("validate:phase7", options.repoRoot);
  results.phase7MigrationRecovery = runNpmScript("test:phase7:migration-recovery", options.repoRoot);
  results.secretScan = await secretScan(options.repoRoot);
  results.artifactIdentity = results.productionBuild.status === STATUS.PASS
    ? await artifactIdentity(options.repoRoot)
    : { status: STATUS.NOT_RUN, reason: "production-build-did-not-pass" };
  const normalized = Object.fromEntries(REQUIRED_GATES.map((gateId) => [gateId, results[gateId]]));
  return {
    formatVersion: 1,
    tool: "phase7-local-ci-release-candidate",
    status: isOverallPass(normalized) ? STATUS.PASS : overallStatus(normalized),
    mandatoryGateCount: REQUIRED_GATES.length,
    gates: normalized,
    policy: {
      localOnly: true,
      networkRequired: false,
      productionTargetsAllowed: false,
      automaticFixtureCleanup: false,
      blockedOrNotRunCannotPass: true,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    emit({ tool: "phase7-local-ci-release-candidate", usage: "[--repo-root <path>] [--expected-commit <sha>] [--expected-branch <branch>]" });
    return;
  }
  if (options.error) {
    emit({ tool: "phase7-local-ci-release-candidate", status: STATUS.BLOCKED, blocker: options.error }, 1);
    return;
  }
  try {
    const evidence = await buildEvidence(options);
    emit(evidence, evidence.status === STATUS.PASS ? 0 : 1);
  } catch (error) {
    const reason = error?.code === "ENOENT" ? "required-local-file-missing" : "local-ci-evidence-error";
    emit({ tool: "phase7-local-ci-release-candidate", status: STATUS.BLOCKED, blocker: reason }, 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
