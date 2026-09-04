import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", BLOCKED: "BLOCKED", NOT_RUN: "NOT_RUN" });

const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const APPROVED_STAGING_PROJECT = "nftufhffzlokryafcbku";
const APPROVED_ENVIRONMENTS = new Set(["local-disposable", "non-production-staging"]);
const APPROVED_OPERATOR_ROLES = new Set(["supabase-project-owner", "release-operator"]);
const APPROVER_ROLE = "release-approver";
const FORBIDDEN_KEY = /(?:secret|password|credential|access[_ -]?token|session[_ -]?token|cookie|connection(?:string)?|service[_ -]?role|api[_ -]?key|raw[_ -]?(?:data|contents?|payload)|customer|client[_ -]?data)/i;
const FORBIDDEN_VALUE = /(?:sb_(?:publishable|secret)_[A-Za-z0-9_-]+|(?:eyJ[A-Za-z0-9_-]{20,}\.){2}[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|https?:\/\/|(?:password|secret|token|cookie|connection string)\b)/i;
const DEFAULT_POLICY = Object.freeze({
  approvedStagingProject: APPROVED_STAGING_PROJECT,
  currentSchemaIdentity: "schema-phase7-21",
  currentMigrationManifestDigest: "3efbea43b6b0275f602198109476194b9d230ba185751e638e91935b484912a3",
  approvedPriorReleases: [],
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
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
  if (!value || typeof value !== "object") return typeof value === "string" && FORBIDDEN_VALUE.test(value) ? path : null;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY.test(key)) return `${path}.${key}`;
    const found = unsafePath(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function invalid(reason) {
  return { tool: "phase7-rollback-evidence", status: STATUS.FAIL, valid: false, reason };
}

function allRequiredTrue(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && keys.every((key) => value[key] === true);
}

function validPriorRelease(target, policy) {
  return policy.approvedPriorReleases.find((release) => release.commit.toLowerCase() === target.commit.toLowerCase()
    && release.version === target.version
    && release.schemaIdentity === target.schemaIdentity
    && release.migrationManifestDigest === target.migrationManifestDigest
    && release.artifactIdentity === target.artifactIdentity
    && release.artifactSha256 === target.artifactSha256);
}

function validatePassEvidence(evidence, policy) {
  if (evidence.gateId !== "P7-OPS-02") return invalid("wrong-gate");
  if (!Array.isArray(policy.approvedPriorReleases) || policy.approvedPriorReleases.length === 0) return invalid("rollback-policy-missing");

  const current = evidence.currentRelease;
  if (!current || !COMMIT_SHA.test(current.commit) || current.commit !== current.expectedCommit
    || !VERSION.test(current.version) || current.verified !== true
    || !safeIdentifier(current.schemaIdentity) || !SHA256.test(current.migrationManifestDigest)) {
    return invalid("current-release-mismatch");
  }

  const target = evidence.rollbackTarget;
  if (!target || !COMMIT_SHA.test(target.commit) || !VERSION.test(target.version) || target.verified !== true
    || target.approvedPriorRelease !== true || !safeIdentifier(target.schemaIdentity)
    || !SHA256.test(target.migrationManifestDigest) || !safeIdentifier(target.artifactIdentity)
    || !SHA256.test(target.artifactSha256) || !validPriorRelease(target, policy)) {
    return invalid("rollback-target-not-approved");
  }
  if (current.commit.toLowerCase() === target.commit.toLowerCase()) return invalid("current-and-rollback-release-identical");

  if (current.schemaIdentity !== target.schemaIdentity
    || current.migrationManifestDigest !== target.migrationManifestDigest
    || current.schemaIdentity !== policy.currentSchemaIdentity
    || current.migrationManifestDigest !== policy.currentMigrationManifestDigest) {
    return invalid("rollback-schema-incompatible");
  }

  const destination = evidence.rollbackDestination;
  const destinationIsApproved = destination?.environment === "local-disposable"
    ? destination.identity === "local-rollback-fixture"
    : destination?.environment === "non-production-staging" && destination.identity === policy.approvedStagingProject;
  if (!destination || destination.productionTarget !== false || destination.approved !== true
    || !APPROVED_ENVIRONMENTS.has(destination.environment) || !destinationIsApproved) {
    return invalid("rollback-destination-invalid");
  }

  const artifact = evidence.rollbackArtifact;
  if (!artifact || artifact.identity !== target.artifactIdentity || artifact.sha256 !== target.artifactSha256
    || !SHA256.test(artifact.sha256) || !Number.isSafeInteger(artifact.byteLength) || artifact.byteLength <= 0
    || artifact.matchesApprovedRelease !== true) {
    return invalid("rollback-artifact-mismatch");
  }

  const authorization = evidence.authorization;
  if (!authorization || authorization.status !== "AUTHORIZED"
    || !APPROVED_OPERATOR_ROLES.has(authorization.operatorRole) || authorization.approverRole !== APPROVER_ROLE
    || !safeIdentifier(authorization.operatorId) || !safeIdentifier(authorization.approverId)
    || authorization.operatorId === authorization.approverId || !safeTimestamp(authorization.approvedAt)) {
    return invalid("rollback-authorization-invalid");
  }

  const pre = evidence.preRollback;
  if (!pre || !allRequiredTrue(pre, ["releaseIdentityVerified", "rollbackTargetApproved", "artifactVerified", "schemaCompatibilityVerified", "destinationVerified", "approvalsVerified", "recoveryPlanRecorded"])) {
    return invalid("rollback-prechecks-incomplete");
  }

  const execution = evidence.execution;
  if (!execution || !allRequiredTrue(execution, ["rollbackStarted", "rollbackCompleted"])) return invalid("rollback-execution-incomplete");

  const post = evidence.postRollbackValidation;
  if (!post || !allRequiredTrue(post, ["applicationHealthy", "smokeValidationPassed", "authorizationRegressionPassed", "releaseIdentityVerified", "noProductionContact"])) {
    return invalid("rollback-postchecks-incomplete");
  }

  if (!Array.isArray(evidence.evidenceReferences) || evidence.evidenceReferences.length === 0
    || evidence.evidenceReferences.some((reference) => !safeIdentifier(reference))) return invalid("evidence-reference-invalid");
  if (evidence.outcome?.status !== STATUS.PASS || evidence.outcome.productionContacted !== false) return invalid("rollback-outcome-invalid");

  return {
    tool: "phase7-rollback-evidence",
    formatVersion: 1,
    gateId: "P7-OPS-02",
    status: STATUS.PASS,
    valid: true,
    currentReleaseCommit: current.commit,
    rollbackTargetCommit: target.commit,
    rollbackTargetVersion: target.version,
    rollbackDestination: destination.identity,
    artifactIdentity: artifact.identity,
    migrationManifestDigest: target.migrationManifestDigest,
    evidenceDigest: digest(evidence),
    checks: {
      currentReleaseIdentity: STATUS.PASS,
      rollbackTargetIdentity: STATUS.PASS,
      artifactIdentity: STATUS.PASS,
      schemaMigrationCompatibility: STATUS.PASS,
      destinationSafety: STATUS.PASS,
      authorization: STATUS.PASS,
      preRollbackChecks: STATUS.PASS,
      rollbackExecution: STATUS.PASS,
      postRollbackValidation: STATUS.PASS,
      outcome: STATUS.PASS,
      redaction: STATUS.PASS,
    },
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

export function validateRollbackEvidence(evidence, policy = DEFAULT_POLICY) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { tool: "phase7-rollback-evidence", status: STATUS.BLOCKED, valid: false, reason: "evidence-invalid" };
  const unsafe = unsafePath(evidence);
  if (unsafe) return invalid("redaction-required");
  if (![STATUS.PASS, STATUS.FAIL, STATUS.BLOCKED, STATUS.NOT_RUN].includes(evidence.status)) return { tool: "phase7-rollback-evidence", status: STATUS.BLOCKED, valid: false, reason: "status-invalid" };
  if (evidence.status === STATUS.BLOCKED) return { tool: "phase7-rollback-evidence", status: STATUS.BLOCKED, valid: false, reason: "rollback-blocked" };
  if (evidence.status === STATUS.NOT_RUN) return { tool: "phase7-rollback-evidence", status: STATUS.NOT_RUN, valid: false, reason: "rollback-not-run" };
  if (evidence.status === STATUS.FAIL) return { tool: "phase7-rollback-evidence", status: STATUS.FAIL, valid: false, reason: "rollback-failed" };
  return validatePassEvidence(evidence, policy);
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

async function loadPolicy() {
  const config = JSON.parse(await readFile(join(process.cwd(), "config", "phase7-acceptance.json"), "utf8"));
  return {
    approvedStagingProject: config.targetIdentity?.approvedSupabaseProjectReference,
    currentSchemaIdentity: "schema-phase7-21",
    currentMigrationManifestDigest: config.releaseIdentity?.approvedPriorReleases?.[0]?.migrationManifestDigest,
    approvedPriorReleases: config.releaseIdentity?.approvedPriorReleases,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    emit({ tool: "phase7-rollback-evidence", usage: "--evidence <local-json-path>" }, 0);
    return;
  }
  if (options.error) {
    emit({ tool: "phase7-rollback-evidence", status: STATUS.BLOCKED, valid: false, reason: options.error }, 1);
    return;
  }
  if (!options.evidence) {
    emit({ tool: "phase7-rollback-evidence", status: STATUS.NOT_RUN, valid: false, reason: "evidence-not-supplied" }, 1);
    return;
  }
  try {
    const evidence = JSON.parse(await readFile(options.evidence, "utf8"));
    const result = validateRollbackEvidence(evidence, await loadPolicy());
    emit(result, result.status === STATUS.PASS ? 0 : 1);
  } catch (error) {
    const reason = error?.code === "ENOENT" ? "evidence-file-missing" : "evidence-unreadable";
    emit({ tool: "phase7-rollback-evidence", status: STATUS.BLOCKED, valid: false, reason }, 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
