import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", BLOCKED: "BLOCKED", NOT_RUN: "NOT_RUN" });

const SHA256 = /^[0-9a-f]{64}$/i;
const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const APPROVED_STAGING_PROJECT = "nftufhffzlokryafcbku";
const APPROVED_DESTINATIONS = new Set(["local-recovery-fixture", APPROVED_STAGING_PROJECT]);
const APPROVED_ENVIRONMENTS = new Set(["local-disposable", "non-production-staging"]);
const APPROVED_BACKUP_TYPES = new Set(["database-logical", "database-snapshot"]);
const APPROVED_BACKUP_SCOPES = new Set(["schema-and-data", "database-and-storage"]);
const APPROVED_OPERATOR_ROLES = new Set(["supabase-project-owner", "restore-approver"]);
const FORBIDDEN_KEY = /(?:secret|password|credential|token|cookie|connection|string|service[_ -]?role|api[_ -]?key|raw[_ -]?(?:data|contents?|payload)|customer|client[_ -]?data)/i;
const FORBIDDEN_VALUE = /(?:sb_(?:publishable|secret)_[A-Za-z0-9_-]+|(?:eyJ[A-Za-z0-9_-]{20,}\.){2}[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|https?:\/\/|(?:password|secret|token|cookie|connection string)\b)/i;

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function safeIdentifier(value) {
  return typeof value === "string" && SAFE_IDENTIFIER.test(value);
}

function safeTimestamp(value) {
  return typeof value === "string" && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
}

function unsafePath(value, path = "evidence") {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = unsafePath(value[index], `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && FORBIDDEN_VALUE.test(value)) return path;
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) return `${path}.${key}`;
    const found = unsafePath(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function invalid(reason) {
  return { tool: "phase7-recovery-evidence", status: STATUS.FAIL, valid: false, reason };
}

function allRequiredTrue(value, requiredKeys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && requiredKeys.every((key) => value[key] === true);
}

function validatePassEvidence(evidence) {
  if (evidence.gateId !== "P7-OPS-01") return invalid("wrong-gate");
  const backup = evidence.backup;
  if (!backup || !safeIdentifier(backup.identifier) || !APPROVED_ENVIRONMENTS.has(backup.sourceEnvironment)
    || !safeTimestamp(backup.createdAt) || !COMMIT_SHA.test(backup.releaseCommit)
    || !safeIdentifier(backup.schemaIdentity) || !SHA256.test(backup.migrationManifestDigest)
    || !APPROVED_BACKUP_TYPES.has(backup.type) || !APPROVED_BACKUP_SCOPES.has(backup.scope)) {
    return invalid("backup-identity-invalid");
  }
  if (!backup.artifact || backup.artifact.present !== true || !SHA256.test(backup.artifact.sha256)
    || !Number.isSafeInteger(backup.artifact.byteLength) || backup.artifact.byteLength <= 0) {
    return invalid("backup-integrity-invalid");
  }

  const destination = evidence.restoreDestination;
  if (!destination || destination.productionTarget !== false || destination.approved !== true
    || !APPROVED_DESTINATIONS.has(destination.identity)
    || !APPROVED_ENVIRONMENTS.has(destination.environment)
    || (destination.environment === "non-production-staging" && destination.identity !== APPROVED_STAGING_PROJECT)
    || (destination.environment === "local-disposable" && destination.identity !== "local-recovery-fixture")) {
    return invalid("restore-destination-invalid");
  }

  const authorization = evidence.authorization;
  if (!authorization || authorization.status !== "AUTHORIZED"
    || !APPROVED_OPERATOR_ROLES.has(authorization.operatorRole)
    || authorization.approverRole !== "restore-approver"
    || !safeIdentifier(authorization.operatorId) || !safeIdentifier(authorization.approverId)
    || authorization.operatorId === authorization.approverId || !safeTimestamp(authorization.approvedAt)) {
    return invalid("restore-authorization-invalid");
  }

  const rehearsal = evidence.rehearsal;
  if (!rehearsal || rehearsal.status !== STATUS.PASS
    || !allRequiredTrue(rehearsal.preChecks, ["backupAvailable", "destinationVerified", "approvalsVerified", "releaseIdentityVerified"])
    || !allRequiredTrue(rehearsal.execution, ["restoreStarted", "restoreCompleted"])
    || !allRequiredTrue(rehearsal.postRestoreValidation, ["schemaMigrationIdentity", "securityInvariants", "authorizationIntegrity", "representativeDataIntegrity", "releaseIdentity", "noProductionContact"])
    || rehearsal.outcome !== STATUS.PASS) {
    return invalid("restore-rehearsal-incomplete");
  }

  const refs = evidence.evidenceReferences;
  if (!Array.isArray(refs) || refs.length === 0 || refs.some((reference) => !safeIdentifier(reference))) {
    return invalid("evidence-reference-invalid");
  }
  if (evidence.recoveryOutcome?.status !== STATUS.PASS || evidence.recoveryOutcome.productionContacted !== false) {
    return invalid("recovery-outcome-invalid");
  }

  const checks = {
    backupIdentity: STATUS.PASS,
    backupIntegrity: STATUS.PASS,
    restoreDestinationSafety: STATUS.PASS,
    authorization: STATUS.PASS,
    restoreRehearsal: STATUS.PASS,
    postRestoreValidation: STATUS.PASS,
    recoveryOutcome: STATUS.PASS,
    redaction: STATUS.PASS,
  };
  return {
    tool: "phase7-recovery-evidence",
    formatVersion: 1,
    gateId: "P7-OPS-01",
    status: STATUS.PASS,
    valid: true,
    backupIdentifier: backup.identifier,
    sourceEnvironment: backup.sourceEnvironment,
    restoreDestination: destination.identity,
    releaseCommit: backup.releaseCommit,
    migrationManifestDigest: backup.migrationManifestDigest,
    evidenceDigest: digest(evidence),
    checks,
    policy: {
      localOnly: true,
      networkRequired: false,
      productionTargetsAllowed: false,
      hostedRehearsalPerformedByTool: false,
      blockedOrNotRunCannotPass: true,
      historicalMigrationEditsAllowed: false,
    },
  };
}

export function validateRecoveryEvidence(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { tool: "phase7-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: "evidence-invalid" };
  const unsafe = unsafePath(evidence);
  if (unsafe) return invalid("redaction-required");
  if (![STATUS.PASS, STATUS.FAIL, STATUS.BLOCKED, STATUS.NOT_RUN].includes(evidence.status)) return { tool: "phase7-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: "status-invalid" };
  if (evidence.status === STATUS.BLOCKED) return { tool: "phase7-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: "recovery-blocked" };
  if (evidence.status === STATUS.NOT_RUN) return { tool: "phase7-recovery-evidence", status: STATUS.NOT_RUN, valid: false, reason: "recovery-not-run" };
  if (evidence.status === STATUS.FAIL) return { tool: "phase7-recovery-evidence", status: STATUS.FAIL, valid: false, reason: "recovery-failed" };
  return validatePassEvidence(evidence);
}

function parseArgs(argv) {
  const options = { evidence: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--evidence") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) return { error: "invalid-argument-value" };
      options.evidence = resolve(value);
      index += 1;
      continue;
    }
    if (argument === "--help") return { help: true };
    return { error: "unsupported-argument" };
  }
  return options;
}

function emit(payload, exitCode) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    emit({ tool: "phase7-recovery-evidence", usage: "--evidence <local-json-path>" }, 0);
    return;
  }
  if (options.error) {
    emit({ tool: "phase7-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: options.error }, 1);
    return;
  }
  if (!options.evidence) {
    emit({ tool: "phase7-recovery-evidence", status: STATUS.NOT_RUN, valid: false, reason: "evidence-not-supplied" }, 1);
    return;
  }
  try {
    const evidence = JSON.parse(await readFile(options.evidence, "utf8"));
    const result = validateRecoveryEvidence(evidence);
    emit(result, result.status === STATUS.PASS ? 0 : 1);
  } catch (error) {
    const reason = error?.code === "ENOENT" ? "evidence-file-missing" : "evidence-unreadable";
    emit({ tool: "phase7-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason }, 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
