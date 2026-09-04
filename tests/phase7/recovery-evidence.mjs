import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { validateRecoveryEvidence, STATUS } from "../../tools/validate-phase7-recovery-evidence.mjs";

const toolPath = join(process.cwd(), "tools", "validate-phase7-recovery-evidence.mjs");
const tempPath = join(tmpdir(), `phase7-recovery-${process.pid}.json`);
const baseEvidence = {
  gateId: "P7-OPS-01",
  status: STATUS.PASS,
  backup: {
    identifier: "P7-BACKUP-LOCAL-001",
    sourceEnvironment: "local-disposable",
    createdAt: "2026-01-01T00:00:00.000Z",
    releaseCommit: "0123456789abcdef0123456789abcdef01234567",
    schemaIdentity: "schema-phase7-21",
    migrationManifestDigest: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    type: "database-logical",
    scope: "schema-and-data",
    artifact: { present: true, sha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", byteLength: 128 },
  },
  restoreDestination: { environment: "local-disposable", identity: "local-recovery-fixture", approved: true, productionTarget: false },
  authorization: {
    status: "AUTHORIZED",
    operatorRole: "supabase-project-owner",
    operatorId: "P7-OPERATOR-001",
    approverRole: "restore-approver",
    approverId: "P7-APPROVER-001",
    approvedAt: "2026-01-01T00:01:00.000Z",
  },
  rehearsal: {
    status: STATUS.PASS,
    preChecks: { backupAvailable: true, destinationVerified: true, approvalsVerified: true, releaseIdentityVerified: true },
    execution: { restoreStarted: true, restoreCompleted: true },
    postRestoreValidation: {
      schemaMigrationIdentity: true,
      securityInvariants: true,
      authorizationIntegrity: true,
      representativeDataIntegrity: true,
      releaseIdentity: true,
      noProductionContact: true,
    },
    outcome: STATUS.PASS,
  },
  recoveryOutcome: { status: STATUS.PASS, productionContacted: false },
  evidenceReferences: ["P7-EVIDENCE-001"],
};

function clone(value) {
  return structuredClone(value);
}

function assertSafeOutput(result) {
  assert.doesNotMatch(JSON.stringify(result), /(?:password|secret|token|cookie|credential|connection|string|customer|client[_ -]?data|https?:\/\/)/i);
}

const valid = validateRecoveryEvidence(baseEvidence);
assert.equal(valid.status, STATUS.PASS);
assert.equal(valid.valid, true);
assert.equal(valid.checks.backupIntegrity, STATUS.PASS);
assertSafeOutput(valid);

const missingBackup = clone(baseEvidence);
delete missingBackup.backup;
assert.equal(validateRecoveryEvidence(missingBackup).status, STATUS.FAIL);
assert.equal(validateRecoveryEvidence(missingBackup).reason, "backup-identity-invalid");

const integrityMismatch = clone(baseEvidence);
integrityMismatch.backup.artifact.sha256 = "not-a-checksum";
assert.equal(validateRecoveryEvidence(integrityMismatch).reason, "backup-integrity-invalid");

const productionDestination = clone(baseEvidence);
productionDestination.restoreDestination = { environment: "production", identity: "production", approved: true, productionTarget: true };
assert.equal(validateRecoveryEvidence(productionDestination).reason, "restore-destination-invalid");

const unauthorized = clone(baseEvidence);
unauthorized.authorization.status = "UNAUTHORIZED";
assert.equal(validateRecoveryEvidence(unauthorized).reason, "restore-authorization-invalid");

const incompleteValidation = clone(baseEvidence);
delete incompleteValidation.rehearsal.postRestoreValidation.authorizationIntegrity;
assert.equal(validateRecoveryEvidence(incompleteValidation).reason, "restore-rehearsal-incomplete");

for (const status of [STATUS.BLOCKED, STATUS.NOT_RUN]) {
  const incomplete = clone(baseEvidence);
  incomplete.status = status;
  const result = validateRecoveryEvidence(incomplete);
  assert.equal(result.status, status);
  assert.notEqual(result.status, STATUS.PASS);
}

const redactionViolation = clone(baseEvidence);
redactionViolation.notes = "service password must never be recorded";
const redacted = validateRecoveryEvidence(redactionViolation);
assert.equal(redacted.status, STATUS.FAIL);
assert.equal(redacted.reason, "redaction-required");
assertSafeOutput(redacted);

await writeFile(tempPath, JSON.stringify(baseEvidence));
const cli = spawnSync(process.execPath, [toolPath, "--evidence", tempPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
assert.equal(cli.status, 0);
assert.equal(cli.stderr, "");
assert.equal(JSON.parse(cli.stdout).status, STATUS.PASS);
assertSafeOutput(JSON.parse(cli.stdout));

const source = await readFile(toolPath, "utf8");
assert.doesNotMatch(source, /(?:node:(?:http|https)|\bfetch\s*\(|\baxios\b|\bundici\b)/i);
assert.match(source, /productionTargetsAllowed: false/);
await rm(tempPath, { force: true });

console.log("Phase 7 recovery evidence tests passed.");
