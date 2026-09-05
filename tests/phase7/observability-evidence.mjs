import assert from "node:assert/strict";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { STATUS, validateObservabilityEvidence } from "../../tools/validate-phase7-observability-evidence.mjs";

const toolPath = join(process.cwd(), "tools", "validate-phase7-observability-evidence.mjs");
const tempPath = join(tmpdir(), `phase7-observability-${process.pid}.json`);
const manifestDigest = "57a91a9b8bfc10bb93258b36b57fdb20d2be630c66c70a428a5f49593c712a7d";
const policy = { approvedStagingProject: "nftufhffzlokryafcbku", currentSchemaIdentity: "schema-phase7-22", currentMigrationManifestDigest: manifestDigest };
const source = () => ({ status: STATUS.PASS, availabilityVerified: true, accessControlled: true, retentionReviewed: true, redactionReviewed: true, sensitiveValuesExcluded: true, evidenceReference: "P7-OBS-SOURCE-001" });
const baseEvidence = {
  gateId: "P7-OBS-01",
  status: STATUS.PASS,
  target: { environment: "local-disposable", identity: "local-observability-fixture", approved: true, productionTarget: false },
  releaseIdentity: { status: STATUS.PASS, expectedCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", observedCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", version: "0.1.0", schemaIdentity: "schema-phase7-22", migrationManifestDigest: manifestDigest, verified: true },
  sources: { applicationLogs: source(), supabaseLogs: source(), auditLogs: source() },
  alerts: { status: STATUS.PASS, routingVerified: true, redactionReviewed: true, testNotificationSuppressed: true, requiredSignals: Object.fromEntries(["authFailures", "serverErrors", "databaseErrors", "auditWriteFailures", "migrationFailures", "backupFailures", "queueFailures", "securityEvents"].map((key) => [key, true])) },
  authorization: { status: "AUTHORIZED", operatorRole: "observability-operator", operatorId: "P7-OPERATOR-001", approverRole: "observability-approver", approverId: "P7-APPROVER-001", approvedAt: "2026-01-01T00:02:00.000Z" },
  readiness: { incidentEscalationDefined: true, logAccessBounded: true, auditAccessBounded: true, retentionDefined: true, noProductionContact: true },
  redaction: { secretsExcluded: true, credentialsExcluded: true, tokensExcluded: true, cookiesExcluded: true, sessionValuesExcluded: true, sensitiveEnvironmentExcluded: true, rawPayloadsExcluded: true, customerDataExcluded: true, productionDataExcluded: true },
  evidenceReferences: ["P7-OBS-001"],
  outcome: { status: STATUS.PASS, productionContacted: false, networkRequired: false },
};
const clone = (value) => structuredClone(value);
const validate = (value) => validateObservabilityEvidence(value, policy);
const safeJson = (value) => JSON.stringify(value);

const valid = await validate(baseEvidence);
assert.equal(valid.status, STATUS.PASS);
assert.equal(valid.valid, true);
assert.equal(valid.sourceCount, 3);
assert.doesNotMatch(safeJson(valid), /(?:password|secret|token|cookie|credential|https?:\/\/)/i);

const missingSource = clone(baseEvidence);
delete missingSource.sources.supabaseLogs;
assert.equal((await validate(missingSource)).reason, "log-source-evidence-incomplete");

const missingAlert = clone(baseEvidence);
missingAlert.alerts.requiredSignals.serverErrors = false;
assert.equal((await validate(missingAlert)).reason, "alert-readiness-incomplete");

const productionTarget = clone(baseEvidence);
productionTarget.target = { environment: "production", identity: "production", approved: true, productionTarget: true };
assert.equal((await validate(productionTarget)).reason, "observability-target-invalid");

const arbitraryTarget = clone(baseEvidence);
arbitraryTarget.target = { environment: "non-production-staging", identity: "arbitrary-preview", approved: true, productionTarget: false };
assert.equal((await validate(arbitraryTarget)).reason, "observability-target-invalid");

const unauthorized = clone(baseEvidence);
unauthorized.authorization.status = "UNAUTHORIZED";
assert.equal((await validate(unauthorized)).reason, "observability-authorization-invalid");

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

const sourceText = await readFile(toolPath, "utf8");
assert.doesNotMatch(sourceText, /(?:node:(?:http|https)|\bfetch\s*\(|\baxios\b|\bundici)/i);
assert.match(sourceText, /networkRequired: false/);
await rm(tempPath, { force: true });

console.log("Phase 7 observability evidence tests passed.");
