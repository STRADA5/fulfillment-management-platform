import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", BLOCKED: "BLOCKED", NOT_RUN: "NOT_RUN" });

const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const APPROVED_STAGING_PROJECT = "nftufhffzlokryafcbku";
const APPROVED_ENVIRONMENTS = new Set(["local-disposable", "non-production-staging"]);
const SOURCE_IDS = ["applicationLogs", "supabaseLogs", "auditLogs"];
const ALERT_IDS = ["authFailures", "serverErrors", "databaseErrors", "auditWriteFailures", "migrationFailures", "backupFailures", "queueFailures", "securityEvents"];
const FORBIDDEN_KEY = /(?:secret|password|credential|access[_ -]?token|session[_ -]?token|cookie|connection(?:string)?|service[_ -]?role|api[_ -]?key|raw[_ -]?(?:data|contents?|payload)|customer|client[_ -]?data)/i;
const FORBIDDEN_VALUE = /(?:sb_(?:publishable|secret)_[A-Za-z0-9_-]+|(?:eyJ[A-Za-z0-9_-]{20,}\.){2}[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|https?:\/\/|(?:password|secret|token|cookie|connection string)\b)/i;

const DEFAULT_POLICY = Object.freeze({
  approvedStagingProject: APPROVED_STAGING_PROJECT,
  currentSchemaIdentity: "schema-phase7-21",
  currentMigrationManifestDigest: "3efbea43b6b0275f602198109476194b9d230ba185751e638e91935b484912a3",
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
    // Boolean exclusion attestations are safe evidence controls even though their
    // names intentionally mention the material that must not be recorded.
    const safeRedactionAttestation = /^(?:secrets|credentials|tokens|cookies|sessionValues|sensitiveEnvironment|rawPayloads|customerData|productionData)Excluded$/.test(key) && child === true;
    if (FORBIDDEN_KEY.test(key) && !safeRedactionAttestation) return `${path}.${key}`;
    const found = unsafePath(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

function invalid(reason) {
  return { tool: "phase7-observability-evidence", status: STATUS.FAIL, valid: false, reason };
}

function allRequiredTrue(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && keys.every((key) => value[key] === true);
}

function approvedTarget(target, policy) {
  if (!target || target.productionTarget !== false || target.approved !== true) return false;
  if (!APPROVED_ENVIRONMENTS.has(target.environment)) return false;
  if (target.environment === "local-disposable") return target.identity === "local-observability-fixture";
  return target.identity === policy.approvedStagingProject && target.identity === APPROVED_STAGING_PROJECT;
}

function validatePassEvidence(evidence, policy) {
  if (evidence.gateId !== "P7-OBS-01") return invalid("wrong-gate");

  const target = evidence.target;
  if (!approvedTarget(target, policy)) return invalid("observability-target-invalid");

  const release = evidence.releaseIdentity;
  if (!release || release.status !== STATUS.PASS || !COMMIT_SHA.test(release.expectedCommit)
    || !COMMIT_SHA.test(release.observedCommit) || release.expectedCommit !== release.observedCommit
    || !VERSION.test(release.version) || release.verified !== true
    || release.schemaIdentity !== policy.currentSchemaIdentity
    || release.migrationManifestDigest !== policy.currentMigrationManifestDigest) return invalid("release-identity-invalid");

  const sources = evidence.sources;
  if (!sources || typeof sources !== "object" || Array.isArray(sources)
    || SOURCE_IDS.some((id) => !sources[id] || sources[id].status !== STATUS.PASS
      || sources[id].availabilityVerified !== true || sources[id].accessControlled !== true
      || sources[id].retentionReviewed !== true || sources[id].redactionReviewed !== true
      || sources[id].sensitiveValuesExcluded !== true || !safeIdentifier(sources[id].evidenceReference))) {
    return invalid("log-source-evidence-incomplete");
  }

  const alerts = evidence.alerts;
  if (!alerts || alerts.status !== STATUS.PASS || alerts.routingVerified !== true || alerts.redactionReviewed !== true
    || alerts.testNotificationSuppressed !== true || !alerts.requiredSignals
    || !allRequiredTrue(alerts.requiredSignals, ALERT_IDS)) return invalid("alert-readiness-incomplete");

  const authorization = evidence.authorization;
  if (!authorization || authorization.status !== "AUTHORIZED" || authorization.operatorRole !== "observability-operator"
    || authorization.approverRole !== "observability-approver" || !safeIdentifier(authorization.operatorId)
    || !safeIdentifier(authorization.approverId) || authorization.operatorId === authorization.approverId
    || !safeTimestamp(authorization.approvedAt)) return invalid("observability-authorization-invalid");

  if (!allRequiredTrue(evidence.readiness, ["incidentEscalationDefined", "logAccessBounded", "auditAccessBounded", "retentionDefined", "noProductionContact"])) {
    return invalid("observability-readiness-incomplete");
  }
  if (!evidence.redaction || !allRequiredTrue(evidence.redaction, ["secretsExcluded", "credentialsExcluded", "tokensExcluded", "cookiesExcluded", "sessionValuesExcluded", "sensitiveEnvironmentExcluded", "rawPayloadsExcluded", "customerDataExcluded", "productionDataExcluded"])) {
    return invalid("redaction-required");
  }
  if (!Array.isArray(evidence.evidenceReferences) || evidence.evidenceReferences.length === 0
    || evidence.evidenceReferences.some((reference) => !safeIdentifier(reference))) return invalid("evidence-reference-invalid");

  const outcome = evidence.outcome;
  if (!outcome || outcome.status !== STATUS.PASS || outcome.productionContacted !== false || outcome.networkRequired !== false) return invalid("observability-outcome-invalid");

  return {
    tool: "phase7-observability-evidence",
    formatVersion: 1,
    gateId: "P7-OBS-01",
    status: STATUS.PASS,
    valid: true,
    target: target.identity,
    releaseCommit: release.observedCommit,
    releaseVersion: release.version,
    sourceCount: SOURCE_IDS.length,
    alertCount: ALERT_IDS.length,
    evidenceDigest: digest(evidence),
    checks: {
      targetSafety: STATUS.PASS,
      releaseIdentity: STATUS.PASS,
      logSources: STATUS.PASS,
      alerts: STATUS.PASS,
      authorization: STATUS.PASS,
      readiness: STATUS.PASS,
      redaction: STATUS.PASS,
      outcome: STATUS.PASS,
    },
    policy: {
      localOnly: true,
      networkRequired: false,
      productionTargetsAllowed: false,
      hostedEvidenceRehearsalPerformedByTool: false,
      blockedOrNotRunCannotPass: true,
    },
  };
}

export async function validateObservabilityEvidence(evidence, policy = DEFAULT_POLICY) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { tool: "phase7-observability-evidence", status: STATUS.BLOCKED, valid: false, reason: "evidence-invalid" };
  const unsafe = unsafePath(evidence);
  if (unsafe) return invalid("redaction-required");
  if (![STATUS.PASS, STATUS.FAIL, STATUS.BLOCKED, STATUS.NOT_RUN].includes(evidence.status)) return { tool: "phase7-observability-evidence", status: STATUS.BLOCKED, valid: false, reason: "status-invalid" };
  if (evidence.status === STATUS.BLOCKED) return { tool: "phase7-observability-evidence", status: STATUS.BLOCKED, valid: false, reason: "observability-blocked" };
  if (evidence.status === STATUS.NOT_RUN) return { tool: "phase7-observability-evidence", status: STATUS.NOT_RUN, valid: false, reason: "observability-not-run" };
  if (evidence.status === STATUS.FAIL) return { tool: "phase7-observability-evidence", status: STATUS.FAIL, valid: false, reason: "observability-failed" };
  return validatePassEvidence(evidence, policy);
}

function parseArgs(argv) {
  const options = { evidence: null, repoRoot: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--evidence" || argument === "--repo-root") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) return { error: "invalid-argument-value" };
      if (argument === "--evidence") options.evidence = resolve(value);
      else options.repoRoot = resolve(value);
      index += 1;
    } else if (argument === "--help") return { help: true };
    else return { error: "unsupported-argument" };
  }
  return options;
}

function emit(payload, exitCode) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
  process.exitCode = exitCode;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return emit({ tool: "phase7-observability-evidence", usage: "--evidence <local-json-path> [--repo-root <path>]" }, 0);
  if (options.error) return emit({ tool: "phase7-observability-evidence", status: STATUS.BLOCKED, valid: false, reason: options.error }, 1);
  if (!options.evidence) return emit({ tool: "phase7-observability-evidence", status: STATUS.NOT_RUN, valid: false, reason: "evidence-not-supplied" }, 1);
  try {
    const evidence = JSON.parse(await readFile(options.evidence, "utf8"));
    const config = JSON.parse(await readFile(join(options.repoRoot, "config", "phase7-acceptance.json"), "utf8"));
    const policy = {
      approvedStagingProject: config.targetIdentity?.approvedSupabaseProjectReference,
      currentSchemaIdentity: "schema-phase7-21",
      currentMigrationManifestDigest: config.releaseIdentity?.approvedPriorReleases?.[0]?.migrationManifestDigest,
    };
    const result = await validateObservabilityEvidence(evidence, policy);
    emit(result, result.status === STATUS.PASS ? 0 : 1);
  } catch (error) {
    const reason = error?.code === "ENOENT" ? "required-local-file-missing" : "evidence-unreadable";
    emit({ tool: "phase7-observability-evidence", status: STATUS.BLOCKED, valid: false, reason }, 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
