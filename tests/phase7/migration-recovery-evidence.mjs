import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateMigrationRecoveryEvidence, STATUS, readLocalMigrationIdentity } from "../../tools/validate-phase7-migration-recovery-evidence.mjs";

const toolPath = join(process.cwd(), "tools", "validate-phase7-migration-recovery-evidence.mjs");
const tempPath = join(tmpdir(), `phase7-migration-recovery-${process.pid}.json`);
const identity = await readLocalMigrationIdentity(process.cwd());
const manifestDigest = "3efbea43b6b0275f602198109476194b9d230ba185751e638e91935b484912a3";
const policy = { approvedStagingProject: "nftufhffzlokryafcbku", currentSchemaIdentity: "schema-phase7-21", currentMigrationManifestDigest: manifestDigest };
const baseEvidence = {
  gateId: "P7-OPS-03",
  status: STATUS.PASS,
  migrationIdentity: {
    status: STATUS.PASS,
    expectedCount: identity.count,
    observedCount: identity.count,
    expectedOrder: identity.order,
    observedOrder: identity.order,
    expectedSetDigest: identity.setDigest,
    observedSetDigest: identity.setDigest,
    expectedManifestDigest: manifestDigest,
    manifestDigest: identity.manifestDigest,
    matches: true,
    historicalMigrationsModified: false,
  },
  releaseIdentity: {
    status: STATUS.PASS,
    expectedCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    observedCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    version: "0.1.0",
    schemaIdentity: "schema-phase7-21",
    migrationManifestDigest: manifestDigest,
    verified: true,
  },
  failure: {
    type: "partial-execution",
    executionState: "partial",
    migrationId: "20260819010000_phase1_identity_and_tenancy.sql",
    detectedAt: "2026-01-01T00:01:00.000Z",
    historicalMigrationEdited: false,
  },
  recoveryStrategy: {
    kind: "forward-fix",
    rollbackSupported: false,
    backupRestoreRequired: true,
    operatorApprovalRequired: true,
    expectedRecoveryTarget: "local-migration-recovery-fixture",
    noHistoricalMigrationEdits: true,
  },
  recoveryTarget: { environment: "local-disposable", identity: "local-migration-recovery-fixture", approved: true, productionTarget: false },
  authorization: {
    status: "AUTHORIZED",
    operatorRole: "migration-operator",
    operatorId: "P7-OPERATOR-001",
    approverRole: "migration-approver",
    approverId: "P7-APPROVER-001",
    approvedAt: "2026-01-01T00:02:00.000Z",
  },
  preRecovery: {
    migrationIdentityVerified: true,
    failureStateClassified: true,
    recoveryStrategyApproved: true,
    targetVerified: true,
    approvalsVerified: true,
    backupDependencyVerified: true,
    releaseIdentityVerified: true,
  },
  recoveryExecution: { status: STATUS.PASS, recoveryStarted: true, recoveryCompleted: true },
  postRecoveryValidation: {
    migrationManifestIdentity: true,
    schemaIdentity: true,
    applicationCompatibility: true,
    authorizationSecurityInvariants: true,
    representativeDataIntegrity: true,
    recoveryOutcome: true,
    noProductionContact: true,
  },
  outcome: { status: STATUS.PASS, strategy: "forward-fix", productionContacted: false },
  evidenceReferences: ["P7-MIGRATION-RECOVERY-001"],
};

const clone = (value) => structuredClone(value);
const validate = (value) => validateMigrationRecoveryEvidence(value, policy, identity);

const valid = await validate(baseEvidence);
assert.equal(valid.status, STATUS.PASS);
assert.equal(valid.valid, true);
assert.equal(valid.migrationCount, identity.count);

const missingMigration = clone(baseEvidence);
delete missingMigration.migrationIdentity;
assert.equal((await validate(missingMigration)).reason, "migration-identity-invalid");

const altered = clone(baseEvidence);
altered.migrationIdentity.observedSetDigest = "1111111111111111111111111111111111111111111111111111111111111111";
assert.equal((await validate(altered)).reason, "migration-identity-invalid");

const reordered = clone(baseEvidence);
reordered.migrationIdentity.observedOrder.reverse();
assert.equal((await validate(reordered)).reason, "migration-identity-invalid");

const duplicate = clone(baseEvidence);
duplicate.migrationIdentity.observedOrder[1] = duplicate.migrationIdentity.observedOrder[0];
assert.equal((await validate(duplicate)).reason, "migration-identity-invalid");

const unknownState = clone(baseEvidence);
unknownState.failure.executionState = "unknown";
assert.equal((await validate(unknownState)).reason, "failure-evidence-invalid");

const unsafeRollback = clone(baseEvidence);
unsafeRollback.recoveryStrategy.kind = "rollback";
assert.equal((await validate(unsafeRollback)).reason, "recovery-strategy-invalid");

const productionTarget = clone(baseEvidence);
productionTarget.recoveryTarget = { environment: "production", identity: "production", approved: true, productionTarget: true };
assert.equal((await validate(productionTarget)).reason, "recovery-target-invalid");

const unauthorized = clone(baseEvidence);
unauthorized.authorization.status = "UNAUTHORIZED";
assert.equal((await validate(unauthorized)).reason, "recovery-authorization-invalid");

for (const status of [STATUS.BLOCKED, STATUS.NOT_RUN]) {
  const incomplete = clone(baseEvidence);
  incomplete.status = status;
  const result = await validate(incomplete);
  assert.equal(result.status, status);
  assert.notEqual(result.status, STATUS.PASS);
}

const redactionViolation = clone(baseEvidence);
redactionViolation.notes = "database password must never be recorded";
assert.equal((await validate(redactionViolation)).reason, "redaction-required");

await writeFile(tempPath, JSON.stringify(baseEvidence));
const cli = spawnSync(process.execPath, [toolPath, "--evidence", tempPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
assert.equal(cli.status, 0);
assert.equal(cli.stderr, "");
assert.equal(JSON.parse(cli.stdout).status, STATUS.PASS);
assert.doesNotMatch(cli.stdout, /(?:password|secret|token|cookie|credential|https?:\/\/)/i);

const source = await readFile(toolPath, "utf8");
assert.doesNotMatch(source, /(?:node:(?:http|https)|\bfetch\s*\(|\baxios\b|\bundici)/i);
assert.match(source, /migrationsExecutedByTool: false/);
await rm(tempPath, { force: true });

console.log("Phase 7 migration recovery evidence tests passed.");
