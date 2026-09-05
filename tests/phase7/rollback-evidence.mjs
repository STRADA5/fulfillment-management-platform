import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateRollbackEvidence, STATUS } from "../../tools/validate-phase7-rollback-evidence.mjs";

const toolPath = join(process.cwd(), "tools", "validate-phase7-rollback-evidence.mjs");
const tempPath = join(tmpdir(), `phase7-rollback-${process.pid}.json`);
const currentManifestDigest = "57a91a9b8bfc10bb93258b36b57fdb20d2be630c66c70a428a5f49593c712a7d";
const priorManifestDigest = "3efbea43b6b0275f602198109476194b9d230ba185751e638e91935b484912a3";
const targetCommit = "a7424b4197653d825d7fc8cb6b995a3f961a9606";
const targetArtifact = "0000000000000000000000000000000000000000000000000000000000000000";
const policy = {
  approvedStagingProject: "nftufhffzlokryafcbku",
  currentSchemaIdentity: "schema-phase7-21",
  currentMigrationManifestDigest: priorManifestDigest,
  approvedPriorReleases: [{
    commit: targetCommit,
    version: "0.1.0",
    schemaIdentity: "schema-phase7-21",
    migrationManifestDigest: priorManifestDigest,
    artifactIdentity: "phase7-release-a7424b4",
    artifactSha256: targetArtifact,
  }],
};

const baseEvidence = {
  gateId: "P7-OPS-02",
  status: STATUS.PASS,
  currentRelease: {
    commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    expectedCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    version: "0.1.0",
    verified: true,
    schemaIdentity: "schema-phase7-21",
    migrationManifestDigest: priorManifestDigest,
  },
  rollbackTarget: {
    commit: targetCommit,
    version: "0.1.0",
    verified: true,
    approvedPriorRelease: true,
    schemaIdentity: "schema-phase7-21",
    migrationManifestDigest: priorManifestDigest,
    artifactIdentity: "phase7-release-a7424b4",
    artifactSha256: targetArtifact,
  },
  rollbackArtifact: { identity: "phase7-release-a7424b4", sha256: targetArtifact, byteLength: 2048, matchesApprovedRelease: true },
  rollbackDestination: { environment: "local-disposable", identity: "local-rollback-fixture", approved: true, productionTarget: false },
  authorization: {
    status: "AUTHORIZED",
    operatorRole: "supabase-project-owner",
    operatorId: "P7-OPERATOR-001",
    approverRole: "release-approver",
    approverId: "P7-APPROVER-001",
    approvedAt: "2026-01-01T00:01:00.000Z",
  },
  preRollback: {
    releaseIdentityVerified: true,
    rollbackTargetApproved: true,
    artifactVerified: true,
    schemaCompatibilityVerified: true,
    destinationVerified: true,
    approvalsVerified: true,
    recoveryPlanRecorded: true,
  },
  execution: { rollbackStarted: true, rollbackCompleted: true },
  postRollbackValidation: {
    applicationHealthy: true,
    smokeValidationPassed: true,
    authorizationRegressionPassed: true,
    releaseIdentityVerified: true,
    noProductionContact: true,
  },
  outcome: { status: STATUS.PASS, productionContacted: false },
  evidenceReferences: ["P7-ROLLBACK-EVIDENCE-001"],
};

const clone = (value) => structuredClone(value);
const validate = (value) => validateRollbackEvidence(value, policy);

const valid = validate(baseEvidence);
assert.equal(valid.status, STATUS.PASS);
assert.equal(valid.valid, true);
assert.equal(valid.checks.schemaMigrationCompatibility, STATUS.PASS);

const unknownTarget = clone(baseEvidence);
unknownTarget.rollbackTarget.commit = "cccccccccccccccccccccccccccccccccccccccc";
assert.equal(validate(unknownTarget).reason, "rollback-target-not-approved");

const commitMismatch = clone(baseEvidence);
commitMismatch.currentRelease.commit = "dddddddddddddddddddddddddddddddddddddddd";
assert.equal(validate(commitMismatch).reason, "current-release-mismatch");

const artifactMismatch = clone(baseEvidence);
artifactMismatch.rollbackArtifact.sha256 = "1111111111111111111111111111111111111111111111111111111111111111";
assert.equal(validate(artifactMismatch).reason, "rollback-artifact-mismatch");

const migrationMismatch = clone(baseEvidence);
migrationMismatch.currentRelease.migrationManifestDigest = "2222222222222222222222222222222222222222222222222222222222222222";
assert.equal(validate(migrationMismatch).reason, "rollback-schema-incompatible");

const productionTarget = clone(baseEvidence);
productionTarget.rollbackDestination = { environment: "production", identity: "production", approved: true, productionTarget: true };
assert.equal(validate(productionTarget).reason, "rollback-destination-invalid");

const unauthorized = clone(baseEvidence);
unauthorized.authorization.status = "UNAUTHORIZED";
assert.equal(validate(unauthorized).reason, "rollback-authorization-invalid");

for (const status of [STATUS.BLOCKED, STATUS.NOT_RUN]) {
  const blocked = clone(baseEvidence);
  blocked.status = status;
  const result = validate(blocked);
  assert.equal(result.status, status);
  assert.notEqual(result.status, STATUS.PASS);
}

const redactionViolation = clone(baseEvidence);
redactionViolation.notes = "password must never be recorded";
assert.equal(validate(redactionViolation).reason, "redaction-required");

await writeFile(tempPath, JSON.stringify(baseEvidence));
const cli = spawnSync(process.execPath, [toolPath, "--evidence", tempPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
assert.equal(cli.status, 1);
assert.equal(cli.stderr, "");
assert.equal(JSON.parse(cli.stdout).reason, "rollback-schema-incompatible");
assert.doesNotMatch(cli.stdout, /(?:password|secret|token|cookie|credential|https?:\/\/)/i);

const source = await readFile(toolPath, "utf8");
assert.doesNotMatch(source, /(?:node:(?:http|https)|\bfetch\s*\(|\baxios\b|\bundici\b)/i);
await rm(tempPath, { force: true });

console.log("Phase 7 rollback evidence tests passed.");
