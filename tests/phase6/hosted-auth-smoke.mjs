// Bounded P7 protected-Preview closure; NOT the historical six-role matrix.
// No screenshots, traces, HAR, response bodies, headers or browser errors are logged.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash, createPublicKey, verify } from "node:crypto";
import https from "node:https";
import http from "node:http";
import net from "node:net";
import { createInterface } from "node:readline";
import { attachFeedbackMetadata, feedbackMetadataLines, feedbackProductionRelationship, FEEDBACK_RESOURCE, AUTHENTICATION_LIFECYCLE, authenticationFeedbackPhase } from "../phase7/protected-preview-feedback-metadata.mjs";
import { attachPreauthenticationFatalMetadata, preauthenticationFatalMetadataLines } from "../phase7/protected-preview-preauth-fatal-metadata.mjs";
import { createPreauthenticationNonfatalPolicy, preauthenticationNonfatalLines, isPreauthenticationBlockReceipt } from "../phase7/protected-preview-preauth-nonfatal-policy.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
// Reviewed project linkage + reconciled immutable release evidence. A new deployment
// requires another reviewed tooling repin; environment/CLI URL overrides are rejected.
export const PIN = Object.freeze({
  project: "fulfillment-management-platform",
  projectId: "prj_DSxru65flK5vNipHMtAms9EJ8roT",
  team: "fulfillment-management-platform",
  teamId: "team_zhXZVZz3PeYoRzbIRuDSMyA4",
  url: "https://fulfillment-management-platform-j4ntvrkrz.vercel.app",
  deploymentId: "dpl_HNwQgTJB7oupc81kWJ197RY3o7jt",
  commit: "213a2cea3ebf2435d138b201de0a5883e8d8d4e0",
  environment: "Preview",
  state: "READY",
});
const HOST = new URL(PIN.url).hostname;
const ISSUER = `https://oidc.vercel.com/${PIN.team}`;
const EMAIL = "p6s-20260902040001-b313d7f9.sales-a@synthetic.invalid";
const FIXTURE = "P6S-20260902040001-B313D7F9";
const ALLOWED_PAGES = new Set(["/login", "/dashboard", "/salespeople", "/reports", "/clients", "/administration", "/suppliers", "/suppliers/products", "/favicon.ico"]);

class Refusal extends Error {
  constructor(code) { super(code); this.code = code; }
}
function demand(condition, code) { if (!condition) throw new Refusal(code); }
function emit(key, value = "PASS") { console.log(`P7_${key}=${value}`); }
export function safeCode(error) { return error instanceof Refusal ? error.code : "UNEXPECTED_RUNNER_ERROR"; }

// Evidence vocabulary only: these names grant NO network access. Unknown URL
// components redact rather than risk recording secrets embedded in a URL.
const DIAGNOSTIC_HOSTS = new Set([HOST, "vercel.live", "vercel.com", "nftufhffzlokryafcbku.supabase.co", "fulfillment-management-platform.vercel.app"]);
const DIAGNOSTIC_SEGMENTS = new Set(["login", "dashboard", "salespeople", "reports", "clients", "administration", "suppliers", "products", "favicon.ico", "forgot-password", "_next", "static", "chunks", "app", "_next-live", "feedback", "feedback.js", "auth", "v1", "token", "api"]);
const DIAGNOSTIC_PHASES = new Set(["LOCAL_PREFLIGHT", "LIVE_IDENTITY", "DEVELOPMENT_OIDC", "UNAUTHENTICATED_PROTECTION", "BROWSER_ACCESS", "SALESPERSON_A_AUTHENTICATION", "SALESPERSON_A_IDENTITY", "REPORTS_SESSION", "BOUNDED_DENIALS", "PROTECTION_RECHECK", "CLEANUP"]);
const DIAGNOSTIC_ACTIONS = new Set(["NONE", "NAVIGATE", "VERIFY_ROUTE", "AUTHENTICATE_SALESPERSON_A", "CLICK_REPORTS_LINK", "CLEANUP"]);
const DIAGNOSTIC_RESOURCES = new Set(["document", "stylesheet", "image", "media", "font", "script", "texttrack", "xhr", "fetch", "eventsource", "websocket", "manifest", "other"]);
const attemptRead = (read, fallback = "UNKNOWN") => { try { return read(); } catch { return fallback; } };
const enumValue = (value, values) => values.has(value) ? value : "UNKNOWN";
const tri = (value) => typeof value === "boolean" ? value : "UNKNOWN";

function diagnosticUrl(raw) {
  const url = attemptRead(() => new URL(raw), null);
  const protocol = url && ["https:", "http:"].includes(url.protocol) ? url.protocol : "REDACTED";
  const hostname = url && DIAGNOSTIC_HOSTS.has(url.hostname) ? url.hostname : "REDACTED";
  return {
    url,
    protocol,
    hostname,
    port: url && ["https:", "http:"].includes(url.protocol) ? url.port || (url.protocol === "https:" ? "443" : "80") : "UNKNOWN",
    origin: protocol !== "REDACTED" && hostname !== "REDACTED" ? `${protocol}//${hostname}${url.port ? `:${url.port}` : ""}` : "REDACTED",
    pathname: url && ["https:", "http:"].includes(url.protocol) ? url.pathname.split("/").map((part) => part === "" || DIAGNOSTIC_SEGMENTS.has(part) ? part : "[REDACTED]").join("/") : "REDACTED",
  };
}

// Primitive fields only; raw URL objects, requests, errors and bodies never enter
// the record. Predicate computation observes the SAME values as the unchanged guard.
export function refusalMetadata(raw, error, details = {}) {
  const target = diagnosticUrl(raw);
  const initiating = diagnosticUrl(details.initiatingPage);
  const intended = diagnosticUrl(attemptRead(() => typeof details.intendedPath === "string" ? new URL(details.intendedPath, PIN.url).href : undefined));
  const url = target.url;
  const predicates = {
    ORIGIN_EQUALS_PIN: !!url && url.origin === PIN.url,
    PROTOCOL_HTTPS: !!url && url.protocol === "https:",
    HOSTNAME_EQUALS_PIN: !!url && url.hostname === HOST,
    USERNAME_ABSENT: !!url && !url.username,
    PASSWORD_ABSENT: !!url && !url.password,
    NONDEFAULT_PORT_ABSENT: !!url && !url.port,
    FRAGMENT_ABSENT: !!url && !url.hash,
  };
  const code = safeCode(error);
  const method = enumValue(details.method, new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]));
  const resource = enumValue(details.resourceType, DIAGNOSTIC_RESOURCES);
  const finalPage = details.attribution === "FINAL_PAGE_VALIDATION";
  const navigation = tri(details.navigation);
  const redirect = tri(details.redirect);
  const record = {
    PHASE: enumValue(details.phase, DIAGNOSTIC_PHASES),
    ORIGINAL_LIFECYCLE_PHASE: enumValue(details.lifecyclePhase, new Set(AUTHENTICATION_LIFECYCLE)),
    UTC: new Date().toISOString(),
    ATTRIBUTION: enumValue(details.attribution, new Set(["REQUEST_INTERCEPTION", "FINAL_PAGE_VALIDATION", "WEBSOCKET_INTERCEPTION"])),
    CODE: code,
    INITIATING_ORIGIN: initiating.origin,
    INITIATING_PATH: initiating.pathname,
    INTENDED_ACTION: enumValue(details.intendedAction, DIAGNOSTIC_ACTIONS),
    INTENDED_PATH: intended.pathname,
    INTENDED_URL_FORM: enumValue(details.intendedUrlForm, new Set(["RELATIVE", "ABSOLUTE"])),
    METHOD: method,
    // Playwright request.url()/page.url() expose resolved targets, NOT the
    // original fetch argument. Do not mislabel an intended goto as that request.
    ORIGINAL_URL_FORM: "UNKNOWN",
    TARGET_PROTOCOL: target.protocol,
    TARGET_HOSTNAME: target.hostname,
    TARGET_PORT: target.port,
    TARGET_ORIGIN: target.origin,
    TARGET_PATH: target.pathname,
    RESOURCE_TYPE: resource,
    INITIATOR: finalPage ? "FINAL_PAGE_OBSERVATION" : "UNKNOWN",
    NAVIGATION: navigation,
    FETCH_XHR: resource === "UNKNOWN" ? "UNKNOWN" : ["fetch", "xhr"].includes(resource),
    RSC_QUERY_PRESENT: url ? url.searchParams.has("_rsc") : "UNKNOWN",
    FORM_SUBMISSION: navigation === "UNKNOWN" || method === "UNKNOWN" ? "UNKNOWN" : navigation && method === "POST",
    REDIRECT: redirect,
    QUERY_PRESENT: url ? !!url.search : "UNKNOWN",
    GUARD_RULE: code === "OFF_TARGET_REQUEST_BLOCKED" ? "ASSERT_REQUEST_EXACT_TARGET_COMPOUND" : "OTHER_GUARD_STAGE",
    FIRST_FAILED_PREDICATE: code === "OFF_TARGET_REQUEST_BLOCKED" ? Object.entries(predicates).find(([, value]) => !value)?.[0] ?? "UNKNOWN" : "OTHER_GUARD_STAGE",
    BEFORE_TRANSMISSION: finalPage ? false : tri(details.beforeTransmission),
  };
  for (const [key, value] of Object.entries(predicates)) record[`PREDICATE_${key}`] = value;
  return Object.freeze(record);
}

export function firstRefusalLines(record) {
  return Object.entries(record).map(([key, value]) => `P7_FIRST_REFUSAL_${key}=${typeof value === "boolean" ? String(value).toUpperCase() : value}`);
}

export function createFirstRefusalJournal(publish = () => {}) {
  let first = null;
  let sealed = false;
  return Object.freeze({
    get first() { return first; },
    seal() { sealed = true; },
    capture(raw, error, details) {
      if (first || sealed) return first;
      first = refusalMetadata(raw, error, details); // latch before publish/abort/await
      publish(first);
      return first;
    },
  });
}

export async function abortWithFirstRefusal(journal, request, error, details, abort) {
  try {
    const wasEmpty = !journal.first;
    const first = journal.capture(attemptRead(() => request.url()), error, {
      ...details,
      attribution: "REQUEST_INTERCEPTION",
      initiatingPage: attemptRead(() => request.frame().url()),
      method: attemptRead(() => request.method()),
      resourceType: attemptRead(() => request.resourceType()),
      navigation: attemptRead(() => request.isNavigationRequest()),
      redirect: attemptRead(() => request.redirectedFrom() !== null),
    });
    // Supplement ONLY the already-latched first fatal refusal; never reclassify it.
    if (wasEmpty && first && typeof details.captureFeedbackMetadata === "function") {
      await details.captureFeedbackMetadata();
    }
  } finally { await abort().catch(() => {}); } // original abort; evidence captured first
}

export function assertFinalPage(proof, page, path, journal, details) {
  const raw = page.url();
  try {
    const url = assertRequest(proof, raw);
    demand(url.pathname === path, "UNEXPECTED_APP_ROUTE");
  } catch (error) {
    journal.capture(raw, error, { ...details, attribution: "FINAL_PAGE_VALIDATION", beforeTransmission: false });
    throw error;
  }
}

export function assertEvidence(config, ci) {
  const current = config?.targetIdentity?.currentPreviewDeployment;
  demand(config?.releaseIdentity?.repository === PIN.project, "PROJECT_EVIDENCE_MISMATCH");
  demand(config?.executionPolicy?.productionAccessAllowed === false, "PRODUCTION_POLICY_MISMATCH");
  demand(current?.previewUrl === PIN.url, "URL_EVIDENCE_MISMATCH");
  demand(current?.deploymentId === PIN.deploymentId, "DEPLOYMENT_EVIDENCE_MISMATCH");
  demand(current?.deployedCommit === PIN.commit, "COMMIT_EVIDENCE_MISMATCH");
  demand(current?.target === PIN.environment && current?.productionDeployed === false, "ENVIRONMENT_EVIDENCE_MISMATCH");
  demand(config.targetIdentity.approvedSupabaseProjectReference === "nftufhffzlokryafcbku", "STAGING_PROJECT_MISMATCH");
  const recorded = ci?.hostedIdentityBoundary;
  demand(recorded?.currentPreviewUrl === PIN.url && recorded?.deploymentId === PIN.deploymentId && recorded?.deployedCommit === PIN.commit, "CI_HOSTED_EVIDENCE_MISMATCH");
  demand(ci?.status === "PASS" && ci?.candidate?.commit === "21d7fe78cba61f6f16a49a303a31efa2cf38285e", "VALIDATED_CANDIDATE_EVIDENCE_MISMATCH");
  return PIN;
}
export function localEvidence() {
  return assertEvidence(JSON.parse(readFileSync(resolve(ROOT, "config/phase7-acceptance.json"), "utf8")), JSON.parse(readFileSync(resolve(ROOT, "docs/phase7-ci-release-evidence.json"), "utf8")));
}

export function assertDeployment(deployment, project, team) {
  demand(project?.id === PIN.projectId && project?.name === PIN.project, "PROJECT_MISMATCH");
  demand(project?.accountId === PIN.teamId && team?.id === PIN.teamId && team?.slug === PIN.team, "TEAM_MISMATCH");
  demand(deployment?.projectId === PIN.projectId && deployment?.team?.id === PIN.teamId, "DEPLOYMENT_OWNER_MISMATCH");
  demand(deployment?.id === PIN.deploymentId, "DEPLOYMENT_ID_MISMATCH");
  // Compare the provider's immutable url, NOT its aliases array.
  demand(deployment?.url === HOST, "CANONICAL_URL_MISMATCH");
  demand(deployment?.meta?.gitCommitSha === PIN.commit, "DEPLOYED_COMMIT_MISMATCH");
  demand(!deployment.meta.githubCommitSha || deployment.meta.githubCommitSha === PIN.commit, "CONFLICTING_COMMIT_METADATA");
  // Vercel deployment API represents Preview as explicit null; missing is refused.
  demand(deployment?.target === null && !deployment.customEnvironment, "NOT_PREVIEW");
  demand(deployment?.readyState === PIN.state, "NOT_READY");
  const production = project.targets?.production;
  demand(production?.id !== PIN.deploymentId && production?.url !== HOST && !(production?.alias ?? []).includes(HOST), "PRODUCTION_ALIAS");
  demand(["all", "all_except_custom_domains"].includes(project?.ssoProtection?.deploymentType), "PROTECTION_NOT_ENABLED");
  demand(project?.oidcTokenConfig?.enabled === true && project.oidcTokenConfig.issuerMode === "team", "DEVELOPMENT_OIDC_NOT_CONFIGURED");
  return Object.freeze({ ...PIN, checkedAt: Date.now() });
}
export function assertProof(proof) {
  for (const [key, value] of Object.entries(PIN)) demand(proof?.[key] === value, "TARGET_PROOF_MISMATCH");
  demand(Number.isFinite(proof.checkedAt) && Date.now() >= proof.checkedAt && Date.now() - proof.checkedAt < 600000, "TARGET_PROOF_EXPIRED");
}
export function assertRequest(proof, raw, method = "GET") {
  assertProof(proof);
  let url;
  try { url = new URL(raw); } catch { throw new Refusal("INVALID_REQUEST_URL"); }
  demand(url.origin === PIN.url && url.protocol === "https:" && url.hostname === HOST && !url.username && !url.password && !url.port && !url.hash, "OFF_TARGET_REQUEST_BLOCKED");
  demand(!/%2f|%5c|\\/i.test(url.pathname), "ENCODED_PATH_BLOCKED");
  demand(ALLOWED_PAGES.has(url.pathname) || url.pathname.startsWith("/_next/static/"), "OUT_OF_SCOPE_PATH_BLOCKED");
  demand([...url.searchParams.keys()].every((key) => key === "_rsc"), "OUT_OF_SCOPE_QUERY_BLOCKED");
  demand(method === "GET" || method === "HEAD" || (method === "POST" && url.pathname === "/login" && !url.search), "MUTATION_BLOCKED");
  return url;
}
export function assertTunnel(proof, authority) {
  assertProof(proof);
  demand(authority === `${HOST}:443`, "OFF_TARGET_TUNNEL_BLOCKED");
}
export function assertOidcClaims(claims, now = Date.now() / 1000) {
  demand(claims?.iss === ISSUER && claims?.aud === `https://vercel.com/${PIN.team}`, "OIDC_ISSUER_AUDIENCE_MISMATCH");
  demand(claims?.owner === PIN.team && claims?.owner_id === PIN.teamId && claims?.project === PIN.project && claims?.project_id === PIN.projectId, "OIDC_PROJECT_TEAM_MISMATCH");
  demand(claims?.environment === "development" && claims?.sub === `owner:${PIN.team}:project:${PIN.project}:environment:development`, "OIDC_NOT_DEVELOPMENT");
  demand(Number.isFinite(claims.exp) && claims.exp > now + 120 && Number.isFinite(claims.iat) && claims.iat <= now + 30 && claims.exp - claims.iat <= 43260, "OIDC_EXPIRED_OR_INVALID_TIME");
  demand(claims.nbf === undefined || (Number.isFinite(claims.nbf) && claims.nbf <= now + 30), "OIDC_NOT_YET_VALID");
}

// Explicit allowlist: no inherited bypass, proxy, debug, NODE_OPTIONS, hosted
// credentials, custom Vercel API endpoint, or token environment is consumed.
export function childEnvironment(source = process.env) {
  const names = new Set(["systemroot", "windir", "comspec", "path", "pathext", "userprofile", "appdata", "localappdata", "temp", "tmp", "homedrive", "homepath", "programfiles", "programfiles(x86)"]);
  return Object.fromEntries(Object.entries(source).filter(([name]) => names.has(name.toLowerCase())));
}
export function makeCli(cliPath) {
  demand(cliPath && resolve(cliPath) === cliPath, "VERCEL_CLI_PATH_REQUIRED");
  const pkg = JSON.parse(readFileSync(resolve(dirname(cliPath), "../package.json"), "utf8"));
  demand(pkg.name === "vercel" && pkg.version === "59.11.2", "REVIEWED_VERCEL_CLI_UNAVAILABLE");
  const execute = promisify(execFile);
  return async (...args) => {
    localEvidence(); // Before each approved control-plane operation.
    try {
      const { stdout } = await execute(process.execPath, [cliPath, ...args, "--scope", PIN.teamId, "--non-interactive"], { cwd: ROOT, env: childEnvironment(), windowsHide: true, timeout: 60000, maxBuffer: 2000000 });
      return stdout.trim(); // private memory; never echo subprocess stdout/stderr
    } catch { throw new Refusal(args[0] === "project" ? "DEVELOPMENT_OIDC_ACQUISITION_FAILED" : "VERCEL_METADATA_LOOKUP_FAILED"); }
  };
}
export async function liveProof(cli) {
  // These fixed control-plane GETs are identity discovery, not application access.
  // No Preview request or Credential Manager read is possible until all pass.
  const project = JSON.parse(await cli("api", `/v9/projects/${PIN.projectId}`, "--method", "GET", "--raw"));
  const team = JSON.parse(await cli("api", `/v2/teams/${PIN.teamId}`, "--method", "GET", "--raw"));
  const deployment = JSON.parse(await cli("api", `/v13/deployments/${PIN.deploymentId}`, "--method", "GET", "--raw"));
  const proof = assertDeployment(deployment, project, team);
  // Compare protection privately. Never serialize protectionBypass: its keys are secrets.
  const protectionDigest = createHash("sha256").update(JSON.stringify([project.ssoProtection, project.oidcTokenConfig, project.trustedSources ?? null, project.protectionBypass ?? null])).digest("hex");
  return { proof, protectionDigest, feedbackProductionRelationship: feedbackProductionRelationship(project, PIN) };
}

// Native https never follows redirects. Browser traffic has an additional
// CONNECT allowlist below, because Playwright route() does not intercept every
// redirect hop. No OIDC assertion is attached to control-plane/public-key GETs.
export function getOnce(raw, headers = {}) {
  return new Promise((accept, reject) => {
    const request = https.get(raw, { headers, agent: false, timeout: 20000 }, (response) => {
      const chunks = []; let bytes = 0;
      response.on("data", (chunk) => { bytes += chunk.length; if (bytes > 2000000) request.destroy(); else chunks.push(chunk); });
      response.on("end", () => accept({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on("error", () => reject(new Refusal("HTTPS_RESPONSE_FAILED")));
    });
    request.on("timeout", () => request.destroy());
    request.on("error", () => reject(new Refusal("HTTPS_REQUEST_FAILED")));
  });
}
export async function developmentOidc(cli, proof) {
  assertProof(proof);
  const token = await cli("project", "token", PIN.project);
  const parts = token.split(".");
  demand(parts.length === 3 && parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part)), "OIDC_RESPONSE_INVALID");
  const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
  const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  assertOidcClaims(claims);
  demand(header.alg === "RS256" && typeof header.kid === "string", "OIDC_SIGNATURE_ALGORITHM");
  assertProof(proof);
  const discovery = await getOnce(`${ISSUER}/.well-known/openid-configuration`);
  demand(discovery.status === 200, "OIDC_DISCOVERY_FAILED");
  const metadata = JSON.parse(discovery.body);
  demand(metadata.issuer === ISSUER, "OIDC_DISCOVERY_ISSUER_MISMATCH");
  const jwksUrl = new URL(metadata.jwks_uri);
  demand(jwksUrl.origin === "https://oidc.vercel.com" && !jwksUrl.username && !jwksUrl.password && !jwksUrl.search && !jwksUrl.hash && jwksUrl.pathname.startsWith(`/${PIN.team}/.well-known/`), "OIDC_JWKS_TARGET_BLOCKED");
  assertProof(proof);
  const response = await getOnce(jwksUrl);
  demand(response.status === 200, "OIDC_JWKS_FAILED");
  const keys = JSON.parse(response.body).keys.filter((key) => key.kid === header.kid && key.kty === "RSA" && key.use === "sig");
  demand(keys.length === 1, "OIDC_SIGNING_KEY_UNAVAILABLE");
  demand(verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: keys[0], format: "jwk" }), Buffer.from(parts[2], "base64url")), "OIDC_SIGNATURE_INVALID");
  return { token, claims };
}

export async function createPinnedProxy(proof, connect = net.connect) {
  assertProof(proof);
  const sockets = new Set();
  const server = http.createServer((_request, response) => { response.writeHead(403); response.end(); });
  server.on("connection", (socket) => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); socket.on("error", () => {}); });
  server.on("connect", (request, client, head) => {
    try { assertTunnel(proof, request.url); }
    catch { client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return; }
    // No DNS lookup or upstream socket is created for a rejected destination.
    const upstream = connect({ host: HOST, port: 443 });
    sockets.add(upstream);
    upstream.on("close", () => sockets.delete(upstream));
    upstream.on("error", () => client.destroy());
    client.on("error", () => upstream.destroy());
    upstream.once("connect", () => { client.write("HTTP/1.1 200 Connection Established\r\n\r\n"); if (head.length) upstream.write(head); client.pipe(upstream); upstream.pipe(client); });
  });
  await new Promise((accept, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", accept); });
  return { url: `http://127.0.0.1:${server.address().port}`, close: async () => { for (const socket of sockets) socket.destroy(); await new Promise((accept) => server.close(accept)); } };
}

async function credentialFromLauncher() {
  demand(process.argv.includes("--credential-pipe"), "PROTECTED_CREDENTIAL_PIPE_REQUIRED");
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const answer = new Promise((accept, reject) => {
    const timeout = setTimeout(() => reject(new Refusal("CREDENTIAL_PIPE_TIMEOUT")), 15000);
    lines.once("line", (line) => { clearTimeout(timeout); accept(line); });
    lines.once("close", () => { clearTimeout(timeout); reject(new Refusal("CREDENTIAL_PIPE_CLOSED")); });
  });
  console.log("P7_CREDENTIAL_REQUEST"); // launcher intercepts; not an evidence record
  try {
    const record = JSON.parse(await answer);
    demand(record.target === "FMP-P6S-STAGING-SALES_A" && record.email === EMAIL && typeof record.password === "string" && record.password.length > 0, "SALESPERSON_A_CREDENTIAL_INVALID");
    return record;
  } finally { lines.close(); }
}
function assertAppUrl(page, path, initiatingPage, lifecyclePhase) { assertFinalPage(currentProof, page, path, firstRefusal, { ...diagnosticContext(lifecyclePhase), initiatingPage }); }
let currentProof;
let currentStage = "LOCAL_PREFLIGHT";
let intendedAction = "NONE";
let intendedPath;
let intendedUrlForm = "UNKNOWN";
const firstRefusal = createFirstRefusalJournal((record) => { for (const line of firstRefusalLines(record)) console.log(line); });
function diagnosticContext(lifecyclePhase) { return { phase: currentStage, lifecyclePhase, intendedAction, intendedPath, intendedUrlForm }; }
let verificationStarted = false;
function stage(name) { currentStage = name; emit("STAGE", name); }
async function pageText(page) { return (await page.locator("body").innerText()).replace(/\s+/g, " ").toUpperCase(); }
async function assignedBoundary(page) {
  const text = await pageText(page);
  demand(text.includes(`${FIXTURE} CLIENT A`) && !text.includes(`${FIXTURE} CLIENT B`) && !text.includes(`${FIXTURE} SALES B`), "ASSIGNED_CLIENT_OR_SALESPERSON_BOUNDARY_FAILED");
}

// Diagnostic control flow only. No target or request decision is made here.
// Reuse the existing 30-second post-submit authentication window, not a new
// navigation/retry window. Clock injection is local-test-only, never a CLI option.
export const AUTHENTICATION_OBSERVATION_MS = 30000;
export function authenticationCaptureMode(args) {
  const enabled = args.includes("--authentication-metadata-capture");
  demand(!enabled || (!args.includes("--config-check") && !args.includes("--preflight-only") && args.includes("--credential-pipe")), "CONFLICTING_CAPTURE_MODE");
  return enabled;
}
export function createAuthenticationCaptureBoundary(enabled, {
  publish = emit, sealEvidence = () => {}, freezePreauthenticationEvidence = () => {},
  preauthenticationBlockReceipt = () => null,
  clock = { now: () => performance.now(), setTimeout, clearTimeout },
} = {}) {
  let stopped = false; let fatalWork; let fatalCode; let ran = false;
  let feedbackSeen = false; let authentication = "NOT_COMPLETED"; let deadline;
  let authenticationFeedbackSeen = false;
  let feedbackCount = 0; let firstFeedbackRequest;
  // Exactly one current lifecycle; currentStage is only an operational label.
  let lifecyclePhase = "PRE_AUTHENTICATION";
  const requestPhases = new WeakMap();
  const requestPhase = request => requestPhases.get(request) ?? "UNKNOWN";
  let signalStop;
  const stoppedSignal = new Promise(resolve => { signalStop = resolve; });
  const check = () => { demand(!enabled || !stopped, "AUTH_METADATA_CAPTURE_STOPPED"); };
  const transition = (from, to) => {
    check(); demand(lifecyclePhase === from, "AUTH_CAPTURE_LIFECYCLE_TRANSITION_INVALID");
    // Freeze evidence intake before auth eligibility changes; no second lifecycle.
    if (from === "PRE_AUTHENTICATION") freezePreauthenticationEvidence();
    lifecyclePhase = to; publish("AUTH_LIFECYCLE_PHASE", lifecyclePhase);
  };
  publish("AUTH_LIFECYCLE_PHASE", lifecyclePhase);
  const step = async operation => {
    check();
    const pending = Promise.resolve().then(() => { check(); return operation(); });
    const value = enabled ? await Promise.race([pending, stoppedSignal]) : await pending;
    check(); // An in-flight browser operation cannot resume the next operation.
    return value;
  };
  const finish = outcome => {
    stopped = true; signalStop(); sealEvidence();
    publish("FEEDBACK_REQUEST_OBSERVED", feedbackSeen ? "YES" : "NO");
    publish("AUTH_PHASE_FEEDBACK_REQUEST_OBSERVED", authenticationFeedbackSeen ? "YES" : "NO");
    publish("NO_FATAL_REQUEST_CAPTURED", fatalCode ? "NO" : "YES");
    publish("CAPTURE_AUTHENTICATION", authentication);
    publish("AUTHENTICATION_METADATA_CAPTURE", outcome);
  };
  return Object.freeze({
    get stopped() { return enabled && stopped; },
    get lifecyclePhase() { return lifecyclePhase; },
    get authenticationCollectorActive() { return authenticationFeedbackPhase(lifecyclePhase); },
    requestPhase,
    observe(request) {
      if (requestPhases.has(request) || (enabled && stopped)) return;
      requestPhases.set(request, lifecyclePhase); // Latch at first request event, before interception/awaits.
      if (enabled && attemptRead(() => request.url()) === FEEDBACK_RESOURCE) {
        feedbackSeen = true; // Historical/global observation; NOT auth eligibility.
        feedbackCount++; firstFeedbackRequest ??= request;
        if (authenticationFeedbackPhase(requestPhase(request))) authenticationFeedbackSeen = true;
      }
    },
    submitStarted() { transition("PRE_AUTHENTICATION", "AUTHENTICATION_SUBMIT_STARTED"); },
    requestInFlight() { transition("AUTHENTICATION_SUBMIT_STARTED", "AUTHENTICATION_REQUEST_IN_FLIGHT"); },
    beginObservation() {
      if (!enabled) return;
      check(); demand(deadline === undefined, "AUTH_CAPTURE_WINDOW_ALREADY_STARTED");
      deadline = clock.now() + AUTHENTICATION_OBSERVATION_MS;
    },
    firstFatal(code, captureAndAbort) {
      if (!enabled || stopped) return captureAndAbort();
      stopped = true; fatalCode = code; // Synchronous latch BEFORE metadata awaits.
      try { fatalWork = Promise.resolve(captureAndAbort()); }
      catch (error) { fatalWork = Promise.reject(error); }
      void fatalWork.catch(() => {}); // Observed again by run(), never raw-logged.
      signalStop();
      return fatalWork;
    },
    async run(authenticate, verifyFinal) {
      demand(!ran, "AUTH_CAPTURE_ALREADY_RUN"); ran = true;
      try {
        await step(() => authenticate(step));
        // authenticate returns only after the existing dashboard/account checks.
        transition("AUTHENTICATION_REQUEST_IN_FLIGHT", "AUTHENTICATION_SUCCEEDED");
        if (!enabled) {
          transition("AUTHENTICATION_SUCCEEDED", "POST_AUTHENTICATION");
          return await verifyFinal(); // Normal final verification intact.
        }
        authentication = "PASS";
        demand(Number.isFinite(deadline), "AUTH_CAPTURE_WINDOW_NOT_STARTED");
        let timer;
        try {
          await step(() => new Promise(resolve => { timer = clock.setTimeout(resolve, Math.max(0, deadline - clock.now())); }));
        } finally { if (timer !== undefined) clock.clearTimeout(timer); }
        const accountedPreauthenticationBlock = feedbackCount === 1 && !authenticationFeedbackSeen &&
          requestPhase(firstFeedbackRequest) === "PRE_AUTHENTICATION" &&
          isPreauthenticationBlockReceipt(preauthenticationBlockReceipt(), firstFeedbackRequest);
        demand(!feedbackSeen || accountedPreauthenticationBlock, "FEEDBACK_OBSERVED_WITHOUT_FATAL");
        finish(accountedPreauthenticationBlock ? "AUTH_SUCCESS_WITH_PREAUTH_BLOCK" : "NO_FEEDBACK_AUTH_SUCCESS");
        return; // No salesperson/report/isolation/final-closure fall-through.
      } catch (error) {
        if (!enabled) throw error;
        if (fatalCode) {
          let complete = true;
          try { await fatalWork; } catch { complete = false; }
          finish(complete ? "FIRST_FATAL_CAPTURED" : "FIRST_FATAL_CAPTURE_INCOMPLETE");
          throw new Refusal(fatalCode);
        }
        if (authentication !== "PASS") authentication = "FAIL";
        publish("AUTH_CAPTURE_FAILURE", safeCode(error));
        finish(authentication === "FAIL" ? "AUTHENTICATION_FAILED" : "CAPTURE_FAILED");
        throw error;
      }
    },
  });
}
async function main() {
  const args = process.argv.slice(2);
  demand(args.every((arg, index) => ["--config-check", "--preflight-only", "--credential-pipe", "--vercel-cli", "--authentication-metadata-capture"].includes(arg) || args[index - 1] === "--vercel-cli"), "UNSUPPORTED_ARGUMENT");
  const captureMode = authenticationCaptureMode(args);
  demand(!process.env.PHASE6_PREVIEW_URL && !process.env.PHASE7_PREVIEW_URL && !process.env.VERCEL_AUTOMATION_BYPASS_SECRET && !process.env.DEBUG && !process.env.PWDEBUG && !process.env.NODE_OPTIONS, "UNAPPROVED_PROCESS_OVERRIDE");
  localEvidence(); emit("LOCAL_IDENTITY");
  if (args.includes("--config-check")) return;
  demand(args.includes("--vercel-cli"), "VERCEL_CLI_PATH_REQUIRED");
  stage("LIVE_IDENTITY");
  const cli = makeCli(args[args.indexOf("--vercel-cli") + 1]);
  const before = await liveProof(cli);
  currentProof = before.proof; emit("LIVE_IDENTITY"); emit("READY"); emit("PREVIEW_TARGET"); emit("PROTECTION_ENABLED");
  if (args.includes("--preflight-only")) return;
  stage("DEVELOPMENT_OIDC");
  const oidc = await developmentOidc(cli, currentProof); emit("DEVELOPMENT_OIDC");

  const loginUrl = `${PIN.url}/login`;
  assertRequest(currentProof, loginUrl);
  stage("UNAUTHENTICATED_PROTECTION"); verificationStarted = true;
  const unauthenticated = await getOnce(loginUrl);
  let ssoRedirect = false;
  if (unauthenticated.headers.location) {
    const location = new URL(unauthenticated.headers.location, loginUrl);
    ssoRedirect = location.origin === "https://vercel.com" && location.pathname === "/sso-api";
  }
  demand(([301, 302, 303, 307, 308].includes(unauthenticated.status) && ssoRedirect) || ([401, 403].includes(unauthenticated.status) && /Vercel Authentication|Authentication Required|Deployment Protection/i.test(unauthenticated.body.toString())), "UNAUTHENTICATED_PROTECTION_NOT_PROVEN");
  emit("UNAUTHENTICATED_PROTECTION"); // External Location inspected only; never followed.

  const proxy = await createPinnedProxy(currentProof);
  let browser; let record; let context; let feedbackObserver; let preauthenticationObserver; let preauthenticationPolicy;
  let loginPermit = false; let loginPosts = 0; let policyFailure;
  const captureBoundary = createAuthenticationCaptureBoundary(captureMode, {
    sealEvidence: () => { firstRefusal.seal(); feedbackObserver?.seal(); preauthenticationObserver?.freeze(); },
    freezePreauthenticationEvidence: () => { preauthenticationPolicy?.freeze(); preauthenticationObserver?.freeze(); },
    preauthenticationBlockReceipt: () => preauthenticationPolicy?.first,
  });
  try {
    stage("BROWSER_ACCESS");
    // Disable HTTP/2 origin coalescing and QUIC, so an existing allowed tunnel
    // cannot carry a redirected request to another wildcard-certificate origin.
    browser = await chromium.launch({ headless: true, channel: "msedge", env: childEnvironment(), proxy: { server: proxy.url, bypass: "<-loopback>" }, args: ["--disable-http2", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
    context = await browser.newContext({ baseURL: PIN.url, serviceWorkers: "block", acceptDownloads: false });
    context.setDefaultTimeout(15000);
    context.on("request", captureBoundary.observe);
    await context.routeWebSocket("**/*", (socket) => {
      policyFailure ??= "WEBSOCKET_BLOCKED";
      void captureBoundary.firstFatal(policyFailure, () => {
        firstRefusal.capture(attemptRead(() => socket.url()), new Refusal("WEBSOCKET_BLOCKED"), { ...diagnosticContext(captureBoundary.lifecyclePhase), attribution: "WEBSOCKET_INTERCEPTION", resourceType: "websocket", beforeTransmission: true });
        return socket.close();
      });
    });
    await context.route("**/*", async (route) => {
      const request = route.request();
      // One interception owns one abort operation. The preauth path and fatal
      // fallback share its settled/pending/rejected result, never a second abort.
      // This closure is request-local; distinct requests retain independent aborts.
      let abortTask;
      const abortOnce = () => abortTask ??= Promise.resolve().then(() => route.abort());
      const requestContext = diagnosticContext(captureBoundary.requestPhase(request));
      let beforeTransmission = true;
      try {
        assertRequest(currentProof, request.url(), request.method()); assertOidcClaims(oidc.claims);
        // The shortcut cannot mask a second/near/UNKNOWN off-target refusal.
        if (request.headers()["next-router-prefetch"] === "1") { await abortOnce(); return; }
        if (request.method() === "POST") {
          demand(loginPermit && loginPosts === 0 && !!request.headers()["next-action"], "UNAUTHORIZED_POST_BLOCKED");
          loginPosts += 1; loginPermit = false;
        }
        const headers = { ...request.headers(), "x-vercel-trusted-oidc-idp-token": oidc.token };
        demand(!headers["x-vercel-protection-bypass"] && !headers.authorization, "BROAD_AUTH_HEADER_BLOCKED");
        if (request.method() === "POST") captureBoundary.requestInFlight();
        beforeTransmission = false;
        await route.continue({ headers }); // CONNECT guard also covers un-intercepted redirects.
      } catch (error) {
        if (await preauthenticationPolicy?.tryBlocked(request, safeCode(error), beforeTransmission, abortOnce)) return;
        policyFailure ??= safeCode(error);
        await captureBoundary.firstFatal(policyFailure, async () => {
        await abortWithFirstRefusal(firstRefusal, request, error, { ...requestContext, beforeTransmission,
          captureFeedbackMetadata: async () => {
            // Already blocked/fatal and globally latched. The observer cannot
            // return a permission or reclassify the existing guard's refusal.
            await preauthenticationObserver?.capture(request, firstRefusal.first, metadata => { for (const line of preauthenticationFatalMetadataLines(metadata)) console.log(line); });
            await feedbackObserver?.capture(request, metadata => { for (const line of feedbackMetadataLines(metadata)) console.log(line); });
          },
        }, abortOnce);
        });
      }
    });
    const page = await context.newPage();
    feedbackObserver = await attachFeedbackMetadata(page, PIN, before.feedbackProductionRelationship, captureBoundary.requestPhase);
    preauthenticationObserver = await attachPreauthenticationFatalMetadata(page, PIN, before.feedbackProductionRelationship, captureBoundary.requestPhase, () => captureBoundary.lifecyclePhase);
    preauthenticationPolicy = createPreauthenticationNonfatalPolicy({
      pin: PIN, phase: () => captureBoundary.lifecyclePhase, requestPhase: captureBoundary.requestPhase,
      verifyTargetAndOidc: () => { assertProof(currentProof); assertOidcClaims(oidc.claims); return true; },
      hasFatal: () => !!policyFailure || !!firstRefusal.first || captureBoundary.stopped,
      inspect: (request, details) => preauthenticationObserver.inspect(request, details),
      publish: receipt => { for (const line of preauthenticationNonfatalLines(receipt)) console.log(line); },
    });
    const go = async (path) => {
      intendedAction = "NAVIGATE"; intendedPath = path; intendedUrlForm = "RELATIVE";
      const initiatingPage = page.url();
      demand(!policyFailure, policyFailure ?? "NETWORK_POLICY_FAILURE");
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });
      demand(!policyFailure, policyFailure ?? "NETWORK_POLICY_FAILURE");
      assertAppUrl(page, path, initiatingPage, captureBoundary.lifecyclePhase);
      intendedAction = "VERIFY_ROUTE";
      return response;
    };
    await captureBoundary.run(async step => {
    const login = await step(() => go("/login"));
    demand(login?.status() === 200, "OIDC_PREVIEW_ACCESS_FAILED"); emit("OIDC_PREVIEW_ACCESS");
    await step(() => page.getByRole("heading", { name: "Sign in", exact: true }).waitFor());
    demand(await step(() => page.locator("input#email").count()) === 1 && await step(() => page.locator("input#password[type=password]").count()) === 1, "LOGIN_FIELDS_NOT_UNIQUE");
    emit("APP_LOGIN");
    // Credential Manager is untouched until identity, OIDC, protection and unique
    // application login controls have all passed. One credential, one attempt.
    await step(async () => {
      record = await credentialFromLauncher();
      if (captureBoundary.stopped) record.password = ""; // Late IPC completion after cancellation.
    });
    await step(() => page.locator("input#email").fill(record.email));
    await step(() => page.locator("input#password").fill(record.password));
    await step(async () => { await preauthenticationPolicy.settle(); demand(!policyFailure, policyFailure ?? "NETWORK_POLICY_FAILURE"); });
    loginPermit = true;
    await step(() => {
      const submit = page.getByRole("button", { name: "Sign in", exact: true });
      stage("SALESPERSON_A_AUTHENTICATION");
      intendedAction = "AUTHENTICATE_SALESPERSON_A"; intendedPath = "/login"; intendedUrlForm = "UNKNOWN";
      captureBoundary.submitStarted();
      return submit.click(); // Explicit intentional submission; no earlier collector activation.
    });
    record.password = "";
    captureBoundary.beginObservation();
    await step(() => page.waitForURL((url) => url.origin === PIN.url && url.pathname === "/dashboard", { timeout: 30000 }));
    demand(loginPosts === 1, "LOGIN_ATTEMPT_COUNT_INVALID");
    await step(() => page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor());
    demand((await step(() => pageText(page))).includes(EMAIL.toUpperCase()), "AUTHENTICATED_EMAIL_MISMATCH");
    emit("SALESPERSON_A_AUTHENTICATION");
    }, async () => {
    stage("SALESPERSON_A_IDENTITY");
    await go("/salespeople");
    await page.getByRole("heading", { name: `${FIXTURE} SALES A`, exact: true }).waitFor();
    await assignedBoundary(page); emit("SALESPERSON_A_IDENTITY"); emit("ASSIGNED_CLIENT_BOUNDARY");
    stage("REPORTS_SESSION");
    const reportsLink = page.getByRole("navigation", { name: "Primary navigation" }).locator('a[href="/reports"]');
    demand(await reportsLink.count() === 1, "REPORTS_LINK_NOT_UNIQUE");
    intendedAction = "CLICK_REPORTS_LINK"; intendedPath = "/reports"; intendedUrlForm = "RELATIVE";
    await reportsLink.click();
    await page.waitForURL((url) => url.origin === PIN.url && url.pathname === "/reports");
    await page.getByRole("heading", { name: "Sales reporting", exact: true }).waitFor();
    const reportText = await pageText(page);
    demand(reportText.includes(EMAIL.toUpperCase()) && reportText.includes("SALESPERSON REPORT"), "REPORTS_SESSION_IDENTITY_MISMATCH");
    demand(!reportText.includes(`${FIXTURE} CLIENT B`) && !reportText.includes(`${FIXTURE} SALES B`), "REPORTS_SCOPE_MISMATCH");
    emit("REPORTS_SESSION_PRESERVATION");
    stage("BOUNDED_DENIALS");
    await go("/clients"); await assignedBoundary(page);
    demand((await pageText(page)).includes("SALESPERSON CLIENT VISIBILITY IS LIMITED TO ACTIVE ASSIGNMENTS."), "ASSIGNED_CLIENT_POLICY_NOT_RENDERED");
    emit("UNASSIGNED_CLIENT_DENIAL"); // assigned-client list boundary; not fabricated cross-tenant RPC evidence
    for (const [path, key] of [["/administration", "PROVIDER_ADMIN_DENIAL"], ["/suppliers", "SUPPLIER_DENIAL"], ["/suppliers/products", "SUPPLIER_COST_DENIAL"]]) {
      const response = await go(path);
      demand([403, 404].includes(response?.status()) || await page.getByRole("heading", { name: "This page could not be found." }).count() === 1, "DENIED_ROUTE_ACCESSIBLE");
      emit(key);
    }
    await go("/salespeople"); await assignedBoundary(page);
    demand(!policyFailure, policyFailure ?? "NETWORK_POLICY_FAILURE");
    stage("PROTECTION_RECHECK");
    const after = await liveProof(cli);
    demand(after.protectionDigest === before.protectionDigest, "PROTECTION_CONFIGURATION_CHANGED");
    emit("PROTECTION_UNCHANGED"); emit("PRODUCTION_REQUEST_COUNT", 0); emit("BOUNDED_CLOSURE");
    });
  } catch (error) { if (policyFailure) throw new Refusal(policyFailure); throw error; }
  finally { firstRefusal.seal(); if (feedbackObserver) { await feedbackObserver.settle(); feedbackObserver.seal(); } if (preauthenticationObserver) { preauthenticationObserver.freeze(); await preauthenticationObserver.settle(); } if (record) record.password = ""; oidc.token = ""; if (context) await context.close(); if (browser) await browser.close(); await proxy.close(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => { emit("FAILURE_STAGE", currentStage); emit("FAILURE", firstRefusal.first?.CODE ?? safeCode(error)); emit("BOUNDED_CLOSURE", verificationStarted ? "FAIL" : "BLOCKED"); process.exitCode = 1; });
}
