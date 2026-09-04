import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  STATUS,
  isOverallPass,
  overallStatus,
  parseArgs,
  releaseIdentityGateFromEvidence,
  scanTextForSecrets,
} from "../../tools/run-phase7-local-ci.mjs";

const allPass = {
  typecheck: { status: STATUS.PASS },
  lint: { status: STATUS.PASS },
  productionBuild: { status: STATUS.PASS },
  securityRegression: { status: STATUS.PASS },
  phase6Authorization: { status: STATUS.PASS },
  phase7ReleaseIdentity: { status: STATUS.PASS },
  phase7Acceptance: { status: STATUS.PASS },
  phase7MigrationRecovery: { status: STATUS.PASS },
  phase7Observability: { status: STATUS.PASS },
  secretScan: { status: STATUS.PASS },
  artifactIdentity: { status: STATUS.PASS },
};

assert.equal(overallStatus(allPass), STATUS.PASS);
assert.equal(isOverallPass(allPass), true);

for (const status of [STATUS.FAIL, STATUS.BLOCKED, STATUS.NOT_RUN]) {
  const failed = { ...allPass, lint: { status } };
  assert.notEqual(overallStatus(failed), STATUS.PASS);
  assert.equal(isOverallPass(failed), false);
}

const validReleaseEvidence = {
  gates: {
    "P7-REL-01": { status: STATUS.PASS },
    "P7-REL-02": {
      localCommitIdentity: { status: STATUS.PASS },
      migrationManifest: { status: STATUS.PASS },
      deploymentIdentity: { status: STATUS.NOT_RUN },
    },
  },
};
assert.equal(releaseIdentityGateFromEvidence(validReleaseEvidence).status, STATUS.PASS);
assert.equal(releaseIdentityGateFromEvidence({
  gates: {
    "P7-REL-01": { status: STATUS.FAIL, checks: { worktreeClean: false } },
    "P7-REL-02": { localCommitIdentity: { status: STATUS.PASS }, migrationManifest: { status: STATUS.PASS } },
  },
}).status, STATUS.FAIL, "dirty worktree must fail closed");
assert.equal(releaseIdentityGateFromEvidence({
  gates: {
    "P7-REL-01": { status: STATUS.PASS },
    "P7-REL-02": { localCommitIdentity: { status: STATUS.FAIL }, migrationManifest: { status: STATUS.PASS } },
  },
}).status, STATUS.FAIL, "commit mismatch must fail closed");

assert.equal(parseArgs(["--target-url", "https://production.example"]).error, "unsupported-argument");
assert.equal(parseArgs(["--target-url", "https://arbitrary.example"]).error, "unsupported-argument");

assert.equal(scanTextForSecrets("safe process.env.SUPABASE_SERVICE_ROLE_KEY value"), false);
assert.equal(scanTextForSecrets(["VERCEL_AUTOMATION_BYPASS_SECRET", "not-a-real-secret-value-1234"].join("=")), true);
assert.equal(scanTextForSecrets(["sb", "secret_1234567890abcdef"].join("_")), true);
assert.equal(scanTextForSecrets(["eyJaaaaaaaaaaaaaaaaaaaa", "eyJbbbbbbbbbbbbbbbbbbbb", "cccccccccccccc"].join(".")), true);

const source = await readFile("tools/run-phase7-local-ci.mjs", "utf8");
assert.doesNotMatch(source, /(?:node:(?:http|https)|\bfetch\s*\(|\baxios\b|\bundici\b)/i);
assert.doesNotMatch(source, /(?:PHASE7_PREVIEW_URL|NEXT_PUBLIC_SUPABASE_URL)/);

console.log("Phase 7 local CI release-candidate tests passed.");
