// Synthetic local objects only. No browser, CLI, credentials, or hosted requests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PIN, assertRequest, safeCode, createFirstRefusalJournal, abortWithFirstRefusal, createAuthenticationCaptureBoundary } from "../phase6/hosted-auth-smoke.mjs";
import { FEEDBACK_RESOURCE, AUTHENTICATION_LIFECYCLE, authenticationFeedbackPhase, feedbackProductionRelationship, feedbackHeaderMetadata, feedbackTrafficMetadata, sanitizeFeedbackMetadata, feedbackMetadataLines, createFeedbackMetadataObserver, attachFeedbackMetadata } from "./protected-preview-feedback-metadata.mjs";

let checks = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const proof = { ...PIN, checkedAt: Date.now() };
const phase = "AUTHENTICATION_REQUEST_IN_FLIGHT";
const secret = "SYNTHETIC_PRIVATE_VALUE_NEVER_RECORD";
const pinProject = { id: PIN.projectId, name: PIN.project, accountId: PIN.teamId, targets: { production: { url: "production.invalid", alias: ["production-alias.invalid"] } } };
const makeEvent = (overrides = {}) => ({
  requestId: "PRIVATE_CORRELATION_ID", frameId: "PRIVATE_FRAME_ID", documentURL: `${PIN.url}/login`, type: "Script",
  request: { url: FEEDBACK_RESOURCE, method: "GET", get headers() { throw Error("EVENT_HEADERS_READ"); }, get postData() { throw Error("BODY_CONTENTS_READ"); } },
  initiator: { type: "parser", url: `${PIN.url}/login` }, ...overrides,
});
function fixture(overrides = {}, options = {}) {
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  const reads = { headers: 0, bodies: 0 };
  const request = {
    url: () => FEEDBACK_RESOURCE, method: () => "GET", resourceType: () => "script", frame: () => frame,
    isNavigationRequest: () => false, redirectedFrom: () => null, serviceWorker: () => null,
    headersArray: async () => { reads.headers++; return [{ name: "referer", value: `${PIN.url}/login` }, { name: "accept", get value() { throw Error("ORDINARY_VALUE_READ"); } }]; },
    postDataBuffer: () => { reads.bodies++; return null; },
    postData() { throw Error("BODY_CONTENTS_READ"); }, postDataJSON() { throw Error("BODY_CONTENTS_READ"); }, ...overrides,
  };
  const phaseForRequest = options.phaseForRequest ?? (() => options.phase ?? phase);
  const observer = createFeedbackMetadataObserver(page, PIN, options.production ?? false, phaseForRequest);
  if (options.arm !== false) observer.arm();
  observer.frameNavigated({ frame: { id: "PRIVATE_FRAME_ID" } });
  options.observeRequest?.(request);
  observer.observe(request);
  if (options.event !== false) observer.requestWillBeSent(options.event ?? makeEvent());
  return { page, frame, request, observer, reads, originalPhase: phaseForRequest(request) };
}
async function capture(test) { return test.observer.capture(test.request); }
async function fatal(test, journal = createFirstRefusalJournal(), onAbort = () => {}) {
  let error;
  try { assertRequest(proof, test.request.url(), test.request.method()); } catch (value) { error = value; }
  assert.ok(error); checks++;
  let aborted = 0;
  await abortWithFirstRefusal(journal, test.request, error, {
    phase: "SALESPERSON_A_AUTHENTICATION", lifecyclePhase: test.originalPhase, beforeTransmission: true,
    captureFeedbackMetadata: () => test.observer.capture(test.request),
  }, async () => {
    eq(journal.first.CODE, safeCode(error)); // Base fatal record exists before abort.
    aborted++; onAbort(test.observer.first);
  });
  eq(aborted, 1);
  return journal;
}

const exact = fixture();
const journal = await fatal(exact, undefined, metadata => {
  eq(metadata.NETWORK_DECISION, "BLOCKED"); eq(metadata.CAPTURE_CONTROL, "FATAL");
});
const first = exact.observer.first;
for (const field of ["EXACT_RESOURCE_IDENTITY", "AUTHENTICATION_PHASE", "HEADERS_COMPLETE", "STRUCTURAL_HEADERS_VALID", "APPROVED_INITIATING_LOGIN", "APPROVED_MAIN_FRAME", "CURRENT_PAGE_LOGIN", "INITIATOR_CORRELATED", "INITIATOR_APPROVED_SOURCE", "INITIATOR_ATTRIBUTION_VERIFIED", "COUNT_COMPLETE", "SINGLE_OCCURRENCE", "PRODUCTION_EXCLUSION_VERIFIED"]) eq(first[field], true);
for (const field of ["BODY_PRESENT", "CREDENTIAL_METADATA_PRESENT", "SESSION_MATERIAL_PRESENT", "SESSION_REQUIRED_MATERIAL_PRESENT", "UNKNOWN_HEADERS_PRESENT", "SERVER_ACTION", "AUTHENTICATION_API", "SUPABASE_AUTH", "APPLICATION_API", "APPLICATION_API_REQUIRED_FOR_LOGIN", "AUTHENTICATION_RELEVANT", "NAVIGATION", "DOCUMENT", "FETCH_XHR", "FORM_SUBMISSION", "REDIRECT_TARGET", "SERVICE_WORKER", "PRODUCTION_TARGET", "INITIATOR_FOREIGN_SOURCE"]) eq(first[field], false);
eq(first.EXACT_OCCURRENCE, 1); eq(first.INITIATOR_TYPE, "PARSER");
eq(first.AUTHENTICATION_OCCURRENCE, 1); eq(first.ORIGINAL_LIFECYCLE_PHASE, phase);
eq(journal.first.ORIGINAL_LIFECYCLE_PHASE, phase);
eq(exact.reads, { headers: 1, bodies: 1 });
eq(Object.isFrozen(first), true);
assert.throws(() => { first.CAPTURE_CONTROL = "CHANGED"; }, TypeError); checks++;
console.log("EXACT_FEEDBACK_BLOCKED_FATAL=PASS");

// A broad operational stage is no longer collector eligibility. Missing/unknown
// lifecycle and every pre/post-auth request stay ineligible without metadata reads.
for (const inactive of ["PRE_AUTHENTICATION", "POST_AUTHENTICATION", "SALESPERSON_A_AUTHENTICATION", "BROWSER_ACCESS", "UNKNOWN", secret]) {
  eq(authenticationFeedbackPhase(inactive), false);
  const test = fixture({}, { phase: inactive });
  await fatal(test); eq(test.observer.first, null); eq(test.reads, { headers: 0, bodies: 0 });
}
for (const active of AUTHENTICATION_LIFECYCLE.slice(1, 4)) {
  eq(authenticationFeedbackPhase(active), true);
  const options = { phase: active };
  const test = fixture({}, options);
  options.phase = "POST_AUTHENTICATION"; // Delayed interception must not relabel the request.
  test.observer.observe(test.request);
  const metadata = await capture(test);
  eq(metadata.ORIGINAL_LIFECYCLE_PHASE, active); eq(metadata.AUTHENTICATION_PHASE, true);
  eq(metadata.CAPTURE_CONTROL, "FATAL"); eq(metadata.NETWORK_DECISION, "BLOCKED");
}

// Exercise the actual boundary's immutable request snapshots, not a second
// current phase. A pre-auth request cannot become an auth capture at submission.
const lifecycle = createAuthenticationCaptureBoundary(true, { publish: () => {} });
const preauth = fixture({}, { phaseForRequest: lifecycle.requestPhase, observeRequest: lifecycle.observe });
eq(lifecycle.authenticationCollectorActive, false);
eq(await capture(preauth), null);
lifecycle.submitStarted(); eq(lifecycle.authenticationCollectorActive, true);
lifecycle.observe(preauth.request); preauth.observer.observe(preauth.request);
eq(lifecycle.requestPhase(preauth.request), "PRE_AUTHENTICATION");
eq(await capture(preauth), null); eq(preauth.reads, { headers: 0, bodies: 0 });
const authRequest = { ...preauth.request };
lifecycle.observe(authRequest); preauth.observer.observe(authRequest);
preauth.observer.requestWillBeSent(makeEvent({ requestId: "PRIVATE_SECOND_ID" }));
lifecycle.requestInFlight();
const authMetadata = await preauth.observer.capture(authRequest);
eq(authMetadata.ORIGINAL_LIFECYCLE_PHASE, "AUTHENTICATION_SUBMIT_STARTED");
eq(authMetadata.AUTHENTICATION_OCCURRENCE, 1);
eq(authMetadata.EXACT_OCCURRENCE, 2); // No reset of global counts/correlation budget.
eq(authMetadata.SINGLE_OCCURRENCE, false); eq(authMetadata.COUNT_COMPLETE, true);
eq(authMetadata.INITIATOR_CORRELATED, false); eq(authMetadata.CAPTURE_CONTROL, "FATAL");
eq(preauth.reads, { headers: 1, bodies: 1 });
// The real adapter fails closed on a missing original request event, even while
// authentication is active. It never substitutes the phase at capture time.
const missingOrigin = fixture({}, { phaseForRequest: lifecycle.requestPhase });
eq(await capture(missingOrigin), null); eq(missingOrigin.reads, { headers: 0, bodies: 0 });
console.log("PREAUTH_INELIGIBLE_ORIGINAL_PHASE_PRESERVED_GLOBAL_COUNTS_NOT_RESET=PASS");

const opaque = new Proxy({}, { get() { throw Error("BODY_CONTENTS_READ"); } });
const withBody = await capture(fixture({ postDataBuffer: () => opaque }));
eq(withBody.BODY_PRESENT, true); eq(withBody.SESSION_MATERIAL_PRESENT, "UNKNOWN");
for (const postDataBuffer of [() => undefined, () => { throw Error(secret); }]) eq((await capture(fixture({ postDataBuffer }))).BODY_PRESENT, "UNKNOWN");
console.log("BODY_PRESENCE_CLASSIFICATION=PASS");

for (const name of ["authorization", "cookie", "x-api-key", "x-vercel-trusted-oidc-idp-token", "x-vercel-protection-bypass", "x-session-id", "password"]) {
  const metadata = await capture(fixture({ headersArray: async () => [{ name, get value() { throw Error("SECRET_HEADER_VALUE_READ"); } }] }));
  eq(metadata.CREDENTIAL_METADATA_PRESENT, true); eq(metadata.AUTHENTICATION_RELEVANT, true);
  eq(metadata.CAPTURE_CONTROL, "FATAL");
  if (/authorization|cookie|token|session/.test(name)) eq(metadata.SESSION_MATERIAL_PRESENT, true);
  eq(metadata.SESSION_REQUIRED_MATERIAL_PRESENT, "UNKNOWN");
}
for (const headersArray of [async () => [{ name: "unknown-header", value: secret }], async () => [{ name: "referer", value: `${PIN.url}/login?secret=${secret}` }], async () => { throw Error(secret); }, async () => null]) {
  const metadata = await capture(fixture({ headersArray }));
  eq(metadata.CREDENTIAL_METADATA_PRESENT, "UNKNOWN"); eq(metadata.SESSION_MATERIAL_PRESENT, "UNKNOWN");
  eq(metadata.AUTHENTICATION_RELEVANT, "UNKNOWN");
}
eq(feedbackHeaderMetadata([{ name: "next-action", value: secret }], PIN, false).SERVER_ACTION, true);
console.log("CREDENTIAL_METADATA_CLASSIFICATION=PASS");
console.log("SESSION_MATERIAL_CLASSIFICATION=PASS");

const facts = { method: "GET", resourceType: "script", phase, navigation: false, redirect: false, serverAction: false, credentialPresent: false, bodyPresent: false };
for (const [url, key] of [["https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", "SUPABASE_AUTH"], [`${PIN.url}/api/auth/session`, "APPLICATION_API"], [`${PIN.url}/auth/check`, "AUTHENTICATION_API"]]) {
  const metadata = feedbackTrafficMetadata(PIN, { ...facts, url });
  eq(metadata[key], true); eq(metadata.AUTHENTICATION_RELEVANT, true);
}
const loginFacts = feedbackTrafficMetadata(PIN, { ...facts, url: `${PIN.url}/login`, method: "POST", resourceType: "fetch", serverAction: true });
eq(loginFacts.APPROVED_LOGIN_ACTION, true); eq(loginFacts.APPLICATION_API_REQUIRED_FOR_LOGIN, true);
eq(assertRequest(proof, `${PIN.url}/login`, "POST").pathname, "/login"); // Same approved login policy.
const formFacts = feedbackTrafficMetadata(PIN, { ...facts, url: FEEDBACK_RESOURCE, method: "POST", resourceType: "document", navigation: true, redirect: true });
eq(formFacts.DOCUMENT, true); eq(formFacts.NAVIGATION, true); eq(formFacts.FORM_SUBMISSION, true); eq(formFacts.REDIRECT_TARGET, true);
eq(feedbackTrafficMetadata(PIN, { url: "not a url" }).AUTHENTICATION_API, "UNKNOWN");
console.log("AUTH_API_REQUIRED_CLASSIFICATION=PASS");
console.log("REDIRECT_NAVIGATION_FORM_CLASSIFICATION=PASS");

for (const raw of [FEEDBACK_RESOURCE + "?x=private", FEEDBACK_RESOURCE + "#private", FEEDBACK_RESOURCE.replace("feedback.js", "other.js"), FEEDBACK_RESOURCE.replace("https:", "http:"), "https://unknown.invalid/feedback.js", "https://production.invalid/login", "https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", `${PIN.url}/api/auth/session`]) {
  const test = fixture({ url: () => raw });
  await fatal(test); eq(test.observer.first, null); eq(test.reads, { headers: 0, bodies: 0 });
}
for (const overrides of [{ method: () => "POST" }, { resourceType: () => "document", isNavigationRequest: () => true }, { resourceType: () => "fetch" }]) {
  const test = fixture(overrides); await fatal(test); eq(test.observer.first, null); eq(test.reads.bodies, 0);
}
console.log("NEAR_MATCH_AUTH_PRODUCTION_UNKNOWN_BLOCKED_FATAL=PASS");

const repeat = { ...exact, request: { ...exact.request } };
exact.observer.observe(repeat.request); exact.observer.requestWillBeSent(makeEvent({ requestId: "PRIVATE_SECOND_ID" }));
await fatal(repeat, journal);
eq(exact.observer.first, first); eq(journal.first.TARGET_PATH, "/_next-live/feedback/feedback.js");
const secondIsFirstFatal = fixture();
secondIsFirstFatal.request = { ...secondIsFirstFatal.request };
secondIsFirstFatal.observer.observe(secondIsFirstFatal.request);
secondIsFirstFatal.observer.requestWillBeSent(makeEvent({ requestId: "PRIVATE_SECOND_ID" }));
await fatal(secondIsFirstFatal);
eq(secondIsFirstFatal.observer.first.EXACT_OCCURRENCE, 2);
eq(secondIsFirstFatal.observer.first.SINGLE_OCCURRENCE, false);
eq(secondIsFirstFatal.observer.first.INITIATOR_CORRELATED, false);
console.log("REPEATED_REQUEST_BLOCKED_FATAL=PASS");

const noNetwork = await capture(fixture({}, { event: false }));
eq(noNetwork.INITIATOR_TYPE, "UNKNOWN"); eq(noNetwork.SINGLE_OCCURRENCE, "UNKNOWN");
eq(noNetwork.COUNT_COMPLETE, false);
const notArmed = await capture(fixture({}, { arm: false }));
eq(notArmed.INITIATOR_CORRELATED, false); eq(notArmed.COUNT_COMPLETE, false);
const foreign = await capture(fixture({}, { event: makeEvent({ initiator: { type: "script", stack: { callFrames: [{ url: `https://foreign.invalid/${secret}` }] } } }) }));
eq(foreign.INITIATOR_TYPE, "SCRIPT"); eq(foreign.INITIATOR_FOREIGN_SOURCE, true); eq(foreign.INITIATOR_ATTRIBUTION_VERIFIED, false);
const ownScript = await capture(fixture({}, { event: makeEvent({ initiator: { type: "script", stack: { callFrames: [{ url: `${PIN.url}/_next/static/chunks/example.js` }] } } }) }));
eq(ownScript.INITIATOR_TYPE, "SCRIPT"); eq(ownScript.INITIATOR_ATTRIBUTION_VERIFIED, true);
for (const event of [makeEvent({ initiator: undefined }), makeEvent({ frameId: "OTHER_FRAME" }), makeEvent({ documentURL: "https://other.invalid/" })]) {
  eq((await capture(fixture({}, { event }))).INITIATOR_ATTRIBUTION_VERIFIED, false);
}
const wrongPhase = fixture({}, { phase: "REPORTS_SESSION" });
await fatal(wrongPhase); eq(wrongPhase.observer.first, null);
const staleFrame = await capture(fixture({ frame: () => { throw Error(secret); }, serviceWorker: () => { throw Error(secret); } }));
eq(staleFrame.APPROVED_MAIN_FRAME, "UNKNOWN"); eq(staleFrame.SERVICE_WORKER, "UNKNOWN");

eq(feedbackProductionRelationship(pinProject, PIN), false);
eq(feedbackProductionRelationship({ ...pinProject, targets: {} }, PIN), false);
for (const project of [{ ...pinProject, id: "wrong" }, { ...pinProject, targets: undefined }, { ...pinProject, targets: { production: {} } }]) eq(feedbackProductionRelationship(project, PIN), "UNKNOWN");
eq(feedbackProductionRelationship({ ...pinProject, targets: { production: { url: "VERCEL.LIVE", alias: [] } } }, PIN), true);
eq(feedbackProductionRelationship({ ...pinProject, targets: { production: { url: "production.invalid", alias: ["vercel.live"] } } }, PIN), true);
eq((await capture(fixture({}, { production: true }))).PRODUCTION_EXCLUSION_VERIFIED, false);
eq((await capture(fixture({}, { production: "UNKNOWN" }))).PRODUCTION_EXCLUSION_VERIFIED, "UNKNOWN");
console.log("INITIATOR_FRAME_COUNT_PRODUCTION_METADATA=PASS");

const concurrent = fixture(); let published = 0;
const both = await Promise.all([concurrent.observer.capture(concurrent.request, () => published++), concurrent.observer.capture(concurrent.request, () => published++)]);
eq(published, 1); eq(both[1], null);
const baseEncoded = JSON.stringify(journal.first); const metadataEncoded = JSON.stringify(first);
journal.seal(); await exact.observer.settle(); exact.observer.seal();
await fatal(fixture(), journal); await exact.observer.capture(exact.request);
eq(JSON.stringify(journal.first), baseEncoded); eq(JSON.stringify(exact.observer.first), metadataEncoded);
const historicalNonfatal = Object.freeze({ captureControl: "NONFATAL_IRRELEVANT_BLOCK" });
eq(historicalNonfatal.captureControl, "NONFATAL_IRRELEVANT_BLOCK"); eq(first.CAPTURE_CONTROL, "FATAL");
console.log("FIRST_REFUSAL_SURVIVES_CLEANUP=PASS");

const unsafe = { ...first, headers: secret, password: secret, body: secret, INITIATOR_TYPE: secret, EXACT_OCCURRENCE: secret, AUTHENTICATION_OCCURRENCE: secret, ORIGINAL_LIFECYCLE_PHASE: secret, BODY_PRESENT: secret };
const encoded = JSON.stringify(sanitizeFeedbackMetadata(unsafe)) + feedbackMetadataLines(unsafe).join("\n") + JSON.stringify(foreign);
eq(encoded.includes(secret), false); eq(encoded.includes("PRIVATE_CORRELATION_ID"), false); eq(encoded.includes("PRIVATE_FRAME_ID"), false);
for (const line of feedbackMetadataLines(first)) { assert.match(line, /^P7_[A-Z0-9_]+=[A-Z0-9_]+$/); checks++; }
eq(sanitizeFeedbackMetadata(unsafe).BODY_PRESENT, "UNKNOWN");
eq(sanitizeFeedbackMetadata(unsafe).ORIGINAL_LIFECYCLE_PHASE, "UNKNOWN");
eq(sanitizeFeedbackMetadata(unsafe).AUTHENTICATION_OCCURRENCE, "UNKNOWN");
console.log("SECRET_REDACTION=PASS");

// Test the actual passive protocol adapter with local doubles: only enabling
// Page/Network notifications; no browser evaluation, injection, input or request.
const handlers = new Map(); const contextHandlers = new Map(); const commands = [];
const protocol = { on: (name, callback) => handlers.set(name, callback), send: async name => commands.push(name) };
const adapterFixture = fixture();
adapterFixture.page.context = () => ({ on: (name, callback) => contextHandlers.set(name, callback), newCDPSession: async () => protocol });
const adapter = await attachFeedbackMetadata(adapterFixture.page, PIN, false, () => phase);
eq(commands, ["Page.enable", "Network.enable"]);
handlers.get("Page.frameNavigated")({ frame: { id: "PRIVATE_FRAME_ID" } });
contextHandlers.get("request")(adapterFixture.request);
handlers.get("Network.requestWillBeSent")(makeEvent());
eq((await adapter.capture(adapterFixture.request)).INITIATOR_CORRELATED, true);
await adapter.settle(); adapter.seal();

const source = readFileSync(new URL("./protected-preview-feedback-metadata.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /route\.continue|\.evaluate\(|evaluateHandle|\.click\(|\.goto\(|\.fill\(|CredRead|NONFATAL_IRRELEVANT_BLOCK|\.postData\(|\.postDataJSON\(/); checks++;
const runner = readFileSync(new URL("../phase6/hosted-auth-smoke.mjs", import.meta.url), "utf8");
assert.match(runner, /feedbackObserver = await attachFeedbackMetadata\(page, PIN, before.feedbackProductionRelationship/); checks++;
assert.match(runner, /policyFailure \?\?= safeCode\(error\);[\s\S]*captureFeedbackMetadata/); checks++;
assert.match(runner, /await feedbackObserver.settle\(\); feedbackObserver.seal\(\)/); checks++;
const evidenceBytes = readFileSync(new URL("../../docs/phase7-vercel-automated-access-evidence.json", import.meta.url));
eq(createHash("sha256").update(evidenceBytes).digest("hex"), "eb902d467d76332894051ed2f3807bead33ddcdc0fda3bf1bd7f11d5d81f74cf");
const evidence = JSON.parse(evidenceBytes);
for (const attempt of [evidence.latestAttempt, evidence.previousSuccessfulAuthenticationAttempt]) {
  eq(attempt.results.salespersonAAuthentication, "PASS"); eq(attempt.results.dashboardReachedAfterLogin, "PASS");
}
console.log("PREVIOUS_AUTHENTICATION_DASHBOARD_EVIDENCE_PRESERVED=PASS");
console.log(`Feedback fatal-only metadata regressions: PASS (${checks} checks; hosted requests: 0; credential reads: 0).`);
