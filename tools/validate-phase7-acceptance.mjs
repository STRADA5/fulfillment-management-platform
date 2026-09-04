import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const configPath = resolve(process.argv[2] ?? "config/phase7-acceptance.json");
const expectedRoles = ["client-b", "client-a", "salesperson-a", "salesperson-b", "fulfillment-operator", "super-admin"];
const requiredGateCategories = ["release-identity", "target-safety", "synthetic-role-matrix", "recovery", "readiness"];
const secretValuePattern = /(?:sb_(?:publishable|secret)_|eyJ[A-Za-z0-9_-]{20,}|service[_ -]?role|password\s*[:=]|access[_ -]?token\s*[:=]|session[_ -]?token\s*[:=])/i;

function fail(message) {
  throw new Error(`Phase 7 acceptance definition invalid: ${message}`);
}

function walk(value, path = "config") {
  if (typeof value === "string" && secretValuePattern.test(value)) fail(`secret-like value at ${path}`);
  if (Array.isArray(value)) value.forEach((entry, index) => walk(entry, `${path}[${index}]`));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, entry]) => walk(entry, `${path}.${key}`));
}

const config = JSON.parse(await readFile(configPath, "utf8"));
walk(config);

if (config.framework !== "phase7-hosted-staging-acceptance") fail("unexpected framework name");
if (config.executionPolicy.localDefinitionValidationOnly !== true) fail("local-only validation is not enabled");
if (config.executionPolicy.productionAccessAllowed !== false) fail("production access is not explicitly disabled");
if (config.executionPolicy.syntheticDataOnly !== true) fail("synthetic-only policy is not enabled");
if (config.targetIdentity.approvedSupabaseProjectReference !== "nftufhffzlokryafcbku") fail("approved staging project reference is incorrect");
if (config.targetIdentity.productionTargetRejectionRequired !== true || config.targetIdentity.arbitraryTargetRejectionRequired !== true) fail("target rejection guards are incomplete");
if (config.targetIdentity.remoteContactedByThisFramework !== false) fail("framework is permitted to contact a remote target");

const roles = config.syntheticRoleMatrix ?? [];
if (roles.length !== expectedRoles.length) fail("synthetic role count is not exactly six");
if (roles.map((role) => role.roleKey).some((role, index) => role !== expectedRoles[index])) fail("synthetic role order does not match the approved matrix");
if (new Set(roles.map((role) => role.roleKey)).size !== expectedRoles.length) fail("synthetic role keys are not unique");
if (roles.some((role, index) => role.order !== index + 1 || !role.label || !role.role || !role.organizationContext || !Array.isArray(role.mustNotAccess))) fail("synthetic role definition is incomplete");

const gates = config.acceptanceGates ?? [];
if (!gates.length) fail("no acceptance gates defined");
for (const category of requiredGateCategories) if (!gates.some((gate) => gate.category === category)) fail(`missing gate category ${category}`);
if (gates.some((gate) => !gate.id || !gate.title || !config.statusVocabulary.includes(gate.status) || !Array.isArray(gate.evidenceRequired) || gate.evidenceRequired.length === 0)) fail("acceptance gate is incomplete");
if (!config.blockers?.some((blocker) => blocker.status === "BLOCKED")) fail("unresolved blocker status is missing");
if (config.evidenceRules.passRequiresEvidence !== true || config.evidenceRules.blockedOrNotRunCannotBeReportedAsPass !== true) fail("evidence status rules are incomplete");

console.log("Phase 7 acceptance definition is valid (local/no-network validation only).");
