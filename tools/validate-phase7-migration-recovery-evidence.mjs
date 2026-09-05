import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL", BLOCKED: "BLOCKED", NOT_RUN: "NOT_RUN" });

const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const VERSION = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MIGRATION_NAME = /^\d+_[A-Za-z0-9_-]+\.sql$/;
const APPROVED_STAGING_PROJECT = "nftufhffzlokryafcbku";
const APPROVED_ENVIRONMENTS = new Set(["local-disposable", "non-production-staging"]);
const APPROVED_OPERATOR_ROLES = new Set(["supabase-project-owner", "migration-operator"]);
const APPROVED_APPROVER_ROLE = "migration-approver";
const FAILURE_TYPES = new Set(["before-execution", "partial-execution", "execution", "post-migration-validation"]);
const RECOVERY_STRATEGIES = new Set(["rollback", "forward-fix", "backup-restore"]);
const EXECUTION_STATES = new Set(["before-execution", "partial", "executing", "post-validation"]);
const FORBIDDEN_KEY = /(?:secret|password|credential|access[_ -]?token|session[_ -]?token|cookie|connection(?:string)?|service[_ -]?role|api[_ -]?key|raw[_ -]?(?:data|contents?|payload)|customer|client[_ -]?data)/i;
const FORBIDDEN_VALUE = /(?:sb_(?:publishable|secret)_[A-Za-z0-9_-]+|(?:eyJ[A-Za-z0-9_-]{20,}\.){2}[A-Za-z0-9_-]{10,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|https?:\/\/|(?:password|secret|token|cookie|connection string)\b)/i;

const DEFAULT_POLICY = Object.freeze({
  approvedStagingProject: APPROVED_STAGING_PROJECT,
  currentSchemaIdentity: "schema-phase7-22",
  currentMigrationManifestDigest: "57a91a9b8bfc10bb93258b36b57fdb20d2be630c66c70a428a5f49593c712a7d",
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value)), "utf8").digest("hex");
}

function lineDigest(lines) {
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

function fileDigest(value) {
  return createHash("sha256").update(value).digest("hex");
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
  return { tool: "phase7-migration-recovery-evidence", status: STATUS.FAIL, valid: false, reason };
}

function allRequiredTrue(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value) && keys.every((key) => value[key] === true);
}

function approvedDestination(destination, policy) {
  if (!destination || destination.productionTarget !== false || destination.approved !== true) return false;
  if (!APPROVED_ENVIRONMENTS.has(destination.environment)) return false;
  if (destination.environment === "local-disposable") return destination.identity === "local-migration-recovery-fixture";
  return destination.environment === "non-production-staging" && destination.identity === policy.approvedStagingProject;
}

function migrationLines(entries, hashes) {
  return entries.map((name, index) => `${name} ${hashes[index]}`);
}

export async function readLocalMigrationIdentity(repoRoot, manifestPath = "docs/migration-manifest.sha256") {
  const migrationDirectory = join(repoRoot, "supabase", "migrations");
  const entries = (await readdir(migrationDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort();
  if (!entries.length || entries.some((name) => !MIGRATION_NAME.test(name))) throw new Error("migration-set-invalid");

  const hashes = [];
  for (const name of entries) hashes.push(fileDigest(await readFile(join(migrationDirectory, name))));
  const localLines = migrationLines(entries, hashes);
  const manifestLines = (await readFile(join(repoRoot, manifestPath), "utf8"))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (manifestLines.some((line) => !/^\S+\s+[0-9a-f]{64}$/i.test(line))) throw new Error("migration-manifest-invalid");

  const canonicalLocal = [...localLines].sort();
  const canonicalManifest = manifestLines.map((line) => line.split(/\s+/).join(" ")).sort();
  // Keep this identical to the existing release-identity evidence tool.
  const localDigest = lineDigest(canonicalLocal);
  const manifestDigest = lineDigest(canonicalManifest);
  const matches = canonicalLocal.length === canonicalManifest.length && canonicalLocal.every((line, index) => line === canonicalManifest[index]);
  return {
    count: entries.length,
    order: entries,
    setDigest: localDigest,
    manifestDigest,
    matches,
    firstMigration: entries[0],
    lastMigration: entries.at(-1),
  };
}

function validatePassEvidence(evidence, policy, localIdentity) {
  if (evidence.gateId !== "P7-OPS-03") return invalid("wrong-gate");

  const migration = evidence.migrationIdentity;
  if (!migration || migration.status !== STATUS.PASS || migration.expectedCount !== localIdentity.count
    || migration.observedCount !== localIdentity.count || !Array.isArray(migration.expectedOrder)
    || !Array.isArray(migration.observedOrder) || JSON.stringify(migration.expectedOrder) !== JSON.stringify(localIdentity.order)
    || JSON.stringify(migration.observedOrder) !== JSON.stringify(localIdentity.order)
    || !SHA256.test(migration.expectedSetDigest) || !SHA256.test(migration.observedSetDigest)
    || !SHA256.test(migration.manifestDigest) || migration.expectedSetDigest !== localIdentity.setDigest
    || migration.observedSetDigest !== localIdentity.setDigest || migration.manifestDigest !== localIdentity.manifestDigest
    || migration.matches !== true
    || localIdentity.matches !== true || migration.historicalMigrationsModified !== false) {
    return invalid("migration-identity-invalid");
  }
  if (migration.expectedManifestDigest !== policy.currentMigrationManifestDigest
    || migration.manifestDigest !== policy.currentMigrationManifestDigest) return invalid("migration-manifest-mismatch");

  const release = evidence.releaseIdentity;
  if (!release || release.status !== STATUS.PASS || !COMMIT_SHA.test(release.expectedCommit)
    || !COMMIT_SHA.test(release.observedCommit) || release.expectedCommit !== release.observedCommit
    || !VERSION.test(release.version) || release.verified !== true
    || !safeIdentifier(release.schemaIdentity) || release.schemaIdentity !== policy.currentSchemaIdentity
    || release.migrationManifestDigest !== policy.currentMigrationManifestDigest
    || release.migrationManifestDigest !== migration.manifestDigest) return invalid("release-identity-invalid");

  const failure = evidence.failure;
  if (!failure || !FAILURE_TYPES.has(failure.type) || !EXECUTION_STATES.has(failure.executionState)
    || !safeIdentifier(failure.migrationId) || !safeTimestamp(failure.detectedAt)
    || failure.historicalMigrationEdited !== false) return invalid("failure-evidence-invalid");

  const strategy = evidence.recoveryStrategy;
  if (!strategy || !RECOVERY_STRATEGIES.has(strategy.kind) || typeof strategy.rollbackSupported !== "boolean"
    || (strategy.kind === "rollback" && strategy.rollbackSupported !== true)
    || (strategy.kind !== "rollback" && strategy.rollbackSupported !== false)
    || typeof strategy.backupRestoreRequired !== "boolean" || strategy.operatorApprovalRequired !== true
    || !safeIdentifier(strategy.expectedRecoveryTarget) || strategy.noHistoricalMigrationEdits !== true) {
    return invalid("recovery-strategy-invalid");
  }

  if (!approvedDestination(evidence.recoveryTarget, policy)) return invalid("recovery-target-invalid");

  const authorization = evidence.authorization;
  if (!authorization || authorization.status !== "AUTHORIZED" || !APPROVED_OPERATOR_ROLES.has(authorization.operatorRole)
    || authorization.approverRole !== APPROVED_APPROVER_ROLE || !safeIdentifier(authorization.operatorId)
    || !safeIdentifier(authorization.approverId) || authorization.operatorId === authorization.approverId
    || !safeTimestamp(authorization.approvedAt)) return invalid("recovery-authorization-invalid");

  const pre = evidence.preRecovery;
  if (!allRequiredTrue(pre, ["migrationIdentityVerified", "failureStateClassified", "recoveryStrategyApproved", "targetVerified", "approvalsVerified", "backupDependencyVerified", "releaseIdentityVerified"])) {
    return invalid("recovery-prechecks-incomplete");
  }

  const execution = evidence.recoveryExecution;
  if (!execution || execution.status !== STATUS.PASS || execution.recoveryStarted !== true || execution.recoveryCompleted !== true) {
    return invalid("recovery-execution-incomplete");
  }

  const post = evidence.postRecoveryValidation;
  if (!allRequiredTrue(post, ["migrationManifestIdentity", "schemaIdentity", "applicationCompatibility", "authorizationSecurityInvariants", "representativeDataIntegrity", "recoveryOutcome", "noProductionContact"])) {
    return invalid("post-recovery-validation-incomplete");
  }

  if (!Array.isArray(evidence.evidenceReferences) || evidence.evidenceReferences.length === 0
    || evidence.evidenceReferences.some((reference) => !safeIdentifier(reference))) return invalid("evidence-reference-invalid");
  if (!evidence.outcome || evidence.outcome.status !== STATUS.PASS || evidence.outcome.productionContacted !== false
    || evidence.outcome.strategy !== strategy.kind) return invalid("recovery-outcome-invalid");

  return {
    tool: "phase7-migration-recovery-evidence",
    formatVersion: 1,
    gateId: "P7-OPS-03",
    status: STATUS.PASS,
    valid: true,
    migrationCount: localIdentity.count,
    firstMigration: localIdentity.firstMigration,
    lastMigration: localIdentity.lastMigration,
    migrationSetDigest: localIdentity.setDigest,
    migrationManifestDigest: localIdentity.manifestDigest,
    releaseCommit: release.observedCommit,
    releaseVersion: release.version,
    failureType: failure.type,
    failedMigration: failure.migrationId,
    recoveryStrategy: strategy.kind,
    recoveryTarget: evidence.recoveryTarget.identity,
    evidenceDigest: digest(evidence),
    checks: {
      migrationIdentity: STATUS.PASS,
      failureEvidence: STATUS.PASS,
      recoveryStrategy: STATUS.PASS,
      destinationSafety: STATUS.PASS,
      authorization: STATUS.PASS,
      postRecoveryValidation: STATUS.PASS,
      outcome: STATUS.PASS,
      redaction: STATUS.PASS,
    },
    policy: {
      localOnly: true,
      networkRequired: false,
      productionTargetsAllowed: false,
      migrationsExecutedByTool: false,
      historicalMigrationEditsAllowed: false,
      blockedOrNotRunCannotPass: true,
      hostedRecoveryRehearsalPerformedByTool: false,
    },
  };
}

export async function validateMigrationRecoveryEvidence(evidence, policy = DEFAULT_POLICY, localIdentity = null) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return { tool: "phase7-migration-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: "evidence-invalid" };
  const unsafe = unsafePath(evidence);
  if (unsafe) return invalid("redaction-required");
  if (![STATUS.PASS, STATUS.FAIL, STATUS.BLOCKED, STATUS.NOT_RUN].includes(evidence.status)) return { tool: "phase7-migration-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: "status-invalid" };
  if (evidence.status === STATUS.BLOCKED) return { tool: "phase7-migration-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: "recovery-blocked" };
  if (evidence.status === STATUS.NOT_RUN) return { tool: "phase7-migration-recovery-evidence", status: STATUS.NOT_RUN, valid: false, reason: "recovery-not-run" };
  if (evidence.status === STATUS.FAIL) return { tool: "phase7-migration-recovery-evidence", status: STATUS.FAIL, valid: false, reason: "recovery-failed" };
  try {
    const identity = localIdentity ?? await readLocalMigrationIdentity(process.cwd());
    return validatePassEvidence(evidence, policy, identity);
  } catch (error) {
    return { tool: "phase7-migration-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: error?.message === "migration-set-invalid" || error?.message === "migration-manifest-invalid" ? error.message : "local-migration-identity-unreadable" };
  }
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
    emit({ tool: "phase7-migration-recovery-evidence", usage: "--evidence <local-json-path> [--repo-root <path>]" }, 0);
    return;
  }
  if (options.error) {
    emit({ tool: "phase7-migration-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason: options.error }, 1);
    return;
  }
  if (!options.evidence) {
    emit({ tool: "phase7-migration-recovery-evidence", status: STATUS.NOT_RUN, valid: false, reason: "evidence-not-supplied" }, 1);
    return;
  }
  try {
    const evidence = JSON.parse(await readFile(options.evidence, "utf8"));
    const config = JSON.parse(await readFile(join(options.repoRoot, "config", "phase7-acceptance.json"), "utf8"));
    const policy = {
      approvedStagingProject: config.targetIdentity?.approvedSupabaseProjectReference,
      currentSchemaIdentity: config.releaseIdentity?.currentSchemaIdentity ?? "schema-phase7-22",
      currentMigrationManifestDigest: config.releaseIdentity?.currentMigrationManifestDigest
        ?? config.releaseIdentity?.approvedPriorReleases?.[0]?.migrationManifestDigest,
    };
    const identity = await readLocalMigrationIdentity(options.repoRoot, config.releaseIdentity?.migrationManifest);
    const result = await validateMigrationRecoveryEvidence(evidence, policy, identity);
    emit(result, result.status === STATUS.PASS ? 0 : 1);
  } catch (error) {
    const reason = error?.code === "ENOENT" ? "required-local-file-missing" : "evidence-unreadable";
    emit({ tool: "phase7-migration-recovery-evidence", status: STATUS.BLOCKED, valid: false, reason }, 1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
