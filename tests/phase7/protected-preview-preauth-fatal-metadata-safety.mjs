// Local doubles only. Importing the guarded runner does not execute its main().
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { setImmediate as tick } from "node:timers/promises";
import { PIN, assertRequest, safeCode, createFirstRefusalJournal, abortWithFirstRefusal, createAuthenticationCaptureBoundary, firstRefusalLines } from "../phase6/hosted-auth-smoke.mjs";
import { FEEDBACK_RESOURCE, AUTHENTICATION_LIFECYCLE, createFeedbackMetadataObserver } from "./protected-preview-feedback-metadata.mjs";
import { createPreauthenticationFatalMetadataObserver, attachPreauthenticationFatalMetadata, sanitizePreauthenticationFatalMetadata, preauthenticationFatalMetadataLines } from "./protected-preview-preauth-fatal-metadata.mjs";

let checks = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const secret = "SYNTHETIC_PRIVATE_SENTINEL_NEVER_EMIT";
const proof = { ...PIN, checkedAt: Date.now() };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function scenario(options = {}) {
  const output = []; const actions = []; const downstream = []; const reads = { headers: 0, bodies: 0 };
  let observer;
  const journal = createFirstRefusalJournal(record => { actions.push("FIRST_BASE"); output.push(...firstRefusalLines(record)); });
  const boundary = createAuthenticationCaptureBoundary(options.enabled !== false, {
    publish: (key, value) => output.push(`P7_${key}=${value}`),
    sealEvidence: () => { journal.seal(); observer.freeze(); },
    freezePreauthenticationEvidence: () => { actions.push("FREEZE_AT_SUBMIT"); observer.freeze(); },
  });
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  observer = createPreauthenticationFatalMetadataObserver(page, PIN, options.production ?? false, boundary.requestPhase, () => boundary.lifecyclePhase);
  const auth = createFeedbackMetadataObserver(page, PIN, options.production ?? false, boundary.requestPhase);
  for (const sink of [observer, auth]) { if (options.arm !== false) sink.arm(); sink.frameNavigated({ frame: { id: "PRIVATE_FRAME" } }); }
  const request = (overrides = {}) => ({
    url: () => FEEDBACK_RESOURCE, method: () => "GET", resourceType: () => "script", frame: () => frame,
    isNavigationRequest: () => false, redirectedFrom: () => null, serviceWorker: () => null,
    headersArray: async () => { reads.headers++; return [{ name: "referer", value: `${PIN.url}/login` }]; },
    postDataBuffer: () => { reads.bodies++; return null; },
    postData() { throw Error("PROHIBITED_BODY_CONTENT_READ"); },
    postDataJSON() { throw Error("PROHIBITED_BODY_CONTENT_READ"); }, ...overrides,
  });
  const event = (overrides = {}) => ({
    requestId: "PRIVATE_REQUEST", frameId: "PRIVATE_FRAME", documentURL: `${PIN.url}/login`, type: "Script",
    request: { url: FEEDBACK_RESOURCE, method: "GET", get headers() { throw Error(secret); }, get postData() { throw Error(secret); } },
    initiator: { type: "parser", url: `${PIN.url}/login` }, ...overrides,
  });
  const observe = (value, protocol = true) => {
    boundary.observe(value); observer.observe(value); auth.observe(value);
    if (protocol) for (const sink of [observer, auth]) sink.requestWillBeSent(event(typeof protocol === "object" ? protocol : {}));
  };
  const run = operation => boundary.run(operation, async () => downstream.push("SALESPERSON_REPORTS_ISOLATION")).then(() => "RETURNED", safeCode);
  return { boundary, observer, auth, page, frame, journal, request, event, observe, run, reads, output, actions, downstream };
}
async function fatal(test, request, onCaptured = () => {}) {
  let error;
  try { assertRequest(proof, request.url(), request.method()); } catch (caught) { error = caught; }
  assert.ok(error); checks++;
  await test.boundary.firstFatal(safeCode(error), () => abortWithFirstRefusal(test.journal, request, error, {
    phase: "BROWSER_ACCESS", lifecyclePhase: test.boundary.requestPhase(request), beforeTransmission: true,
    captureFeedbackMetadata: async () => {
      await test.observer.capture(request, test.journal.first, record => {
        test.output.push(...preauthenticationFatalMetadataLines(record)); test.actions.push("PRE_METADATA"); onCaptured(record);
      });
      await test.auth.capture(request, () => test.actions.push("AUTH_METADATA"));
    },
  }, async () => test.actions.push("ABORT")));
  return safeCode(error);
}

// Real firstFatal -> journal -> supplement -> abort -> terminal path, while an
// in-flight operation is cancelled. No second request decision exists.
const first = scenario(); const firstRequest = first.request(); first.observe(firstRequest);
const hold = deferred();
const firstRun = first.run(async step => { await step(() => hold.promise); first.actions.push("UNAUTHORIZED_CONTINUATION"); });
await tick();
const pending = fatal(first, firstRequest, record => {
  eq(first.journal.first.BEFORE_TRANSMISSION, true);
  eq(first.journal.first.CODE, "OFF_TARGET_REQUEST_BLOCKED");
  eq(record.NETWORK_DECISION, "BLOCKED"); eq(record.CAPTURE_CONTROL, "FATAL");
});
eq(first.boundary.stopped, true);
assert.throws(() => first.boundary.submitStarted(), /AUTH_METADATA_CAPTURE_STOPPED/); checks++;
hold.resolve(); await pending; eq(await firstRun, "OFF_TARGET_REQUEST_BLOCKED");
eq(first.actions, ["FIRST_BASE", "PRE_METADATA", "ABORT"]); eq(first.downstream, []);
eq(first.auth.first, null); eq(first.boundary.authenticationCollectorActive, false);
eq(first.boundary.lifecyclePhase, "PRE_AUTHENTICATION");
eq(first.observer.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION");
eq(first.observer.first.AUTHENTICATION_PHASE, false);
eq(Object.hasOwn(first.observer.first, "AUTHENTICATION_OCCURRENCE"), false);
eq(first.output.includes("P7_AUTH_PHASE_FEEDBACK_REQUEST_OBSERVED=NO"), true);
eq(first.output.includes("P7_AUTHENTICATION_METADATA_CAPTURE=FIRST_FATAL_CAPTURED"), true);
eq(first.output.some(line => line.startsWith("P7_FEEDBACK_BODY_PRESENT=")), false);
eq(first.reads, { headers: 1, bodies: 1 });
for (const key of ["HEADERS_COMPLETE", "STRUCTURAL_HEADERS_VALID", "APPROVED_INITIATING_LOGIN", "APPROVED_MAIN_FRAME", "CURRENT_PAGE_LOGIN", "INITIATOR_CORRELATED", "INITIATOR_APPROVED_SOURCE", "INITIATOR_ATTRIBUTION_VERIFIED", "COUNT_COMPLETE", "SINGLE_OCCURRENCE", "PRODUCTION_EXCLUSION_VERIFIED", "SCRIPT", "BEFORE_TRANSMISSION"]) eq(first.observer.first[key], true);
for (const key of ["BODY_PRESENT", "CREDENTIAL_METADATA_PRESENT", "SESSION_MATERIAL_PRESENT", "SESSION_REQUIRED_MATERIAL_PRESENT", "SERVER_ACTION", "AUTHENTICATION_API", "SUPABASE_AUTH", "APPLICATION_API_REQUIRED_FOR_LOGIN", "NAVIGATION", "DOCUMENT", "FETCH_XHR", "FORM_SUBMISSION", "REDIRECT_TARGET", "SERVICE_WORKER", "PRODUCTION_TARGET", "RSC_QUERY_PRESENT"]) eq(first.observer.first[key], false);
eq(first.observer.first.EXACT_OCCURRENCE, 1); eq(first.observer.first.INITIATOR_TYPE, "PARSER");
eq(first.observer.first.GUARD_RULE, "ASSERT_REQUEST_EXACT_TARGET_COMPOUND");
eq(first.observer.first.FIRST_FAILED_PREDICATE, "ORIGIN_EQUALS_PIN");
console.log("PREAUTH_FATAL_CAPTURE_BEFORE_ABORT_AND_THROW=PASS");
console.log("PREAUTH_CANNOT_ACTIVATE_AUTH_OR_DOWNSTREAM=PASS");

const preserved = first.observer.first; const originalBase = first.journal.first;
const historical = Object.freeze({ captureControl: "NONFATAL_IRRELEVANT_BLOCK" });
first.observer.freeze(); first.journal.seal(); await first.observer.settle();
const later = first.request({ url: () => "https://unknown.invalid/later" }); first.observe(later);
await fatal(first, later);
eq(first.observer.first, preserved); eq(first.journal.first, originalBase);
eq(Object.isFrozen(preserved), true);
assert.throws(() => { preserved.CAPTURE_CONTROL = "ALLOW"; }, TypeError); checks++;
eq(historical.captureControl, "NONFATAL_IRRELEVANT_BLOCK");
eq(first.auth.first, null);
console.log("FIRST_PREAUTH_FATAL_IMMUTABLE_CLEANUP_LATER_AND_HISTORY=PASS");

// Explicit boundary freezes intake before activation; old requests cannot be
// relabeled or counted as auth feedback, even when delivered again after submit.
const split = scenario(); const preRequest = split.request(); split.observe(preRequest);
eq(split.observer.active, true); eq(split.boundary.authenticationCollectorActive, false);
eq(split.auth.first, null); eq(await split.auth.capture(preRequest), null);
eq(split.reads, { headers: 0, bodies: 0 });
split.boundary.submitStarted();
eq(split.actions, ["FREEZE_AT_SUBMIT"]); eq(split.observer.active, false);
eq(split.boundary.authenticationCollectorActive, true);
eq(split.boundary.requestPhase(preRequest), "PRE_AUTHENTICATION");
split.observe(preRequest, false); eq(await split.auth.capture(preRequest), null);
eq(await split.observer.capture(preRequest, originalBase), null);
const authRequest = split.request(); split.observe(authRequest, split.event({ requestId: "PRIVATE_AUTH_REQUEST" }));
split.boundary.requestInFlight();
await fatal(split, authRequest);
eq(split.observer.first, null); eq(split.auth.first.ORIGINAL_LIFECYCLE_PHASE, "AUTHENTICATION_SUBMIT_STARTED");
eq(split.auth.first.AUTHENTICATION_OCCURRENCE, 1); eq(split.auth.first.EXACT_OCCURRENCE, 2);
eq(split.auth.first.SINGLE_OCCURRENCE, false); eq(split.auth.first.CAPTURE_CONTROL, "FATAL");
console.log("SUBMIT_FREEZES_PREAUTH_AUTH_RECORD_AND_COUNTS_SEPARATE=PASS");

// Missing snapshots, inactive phases, or no actual latched fatal refusal do not
// trigger metadata reads. Phase is read-only, never synthesized by the observer.
for (const phase of [...AUTHENTICATION_LIFECYCLE.slice(1), "UNKNOWN"]) {
  const test = scenario(); const request = test.request();
  const sink = createPreauthenticationFatalMetadataObserver(test.page, PIN, false, () => phase, () => phase);
  sink.arm(); sink.observe(request); sink.requestWillBeSent(test.event());
  eq(sink.active, false); eq(await sink.capture(request, originalBase), null); eq(test.reads, { headers: 0, bodies: 0 });
}
const missing = scenario(); const missingRequest = missing.request();
eq(await missing.observer.capture(missingRequest, originalBase), null);
missing.observe(missingRequest); eq(await missing.observer.capture(missingRequest, null), null);
eq(await missing.observer.capture(missingRequest, Object.freeze({ ...originalBase, BEFORE_TRANSMISSION: false })), null);
eq(missing.reads, { headers: 0, bodies: 0 });
console.log("PREAUTH_ONLY_REQUIRES_ORIGINAL_SNAPSHOT_AND_LATCHED_FATAL=PASS");

// Approved requests stay under the unchanged guard; the observer grants nothing.
const approved = scenario(); const approvedRequest = approved.request({ url: () => `${PIN.url}/login` });
approved.observe(approvedRequest, false);
eq(assertRequest(proof, approvedRequest.url()).pathname, "/login");
eq(await approved.observer.capture(approvedRequest, approved.journal.first), null);
eq(approved.reads, { headers: 0, bodies: 0 });
const deniedCases = [
  ["https://fulfillment-management-platform.vercel.app/login", {}],
  [`https://unknown.invalid/${secret}?token=${secret}`, {}],
  [`${PIN.url}/?_rsc=${secret}`, { resourceType: () => "fetch" }],
  [`${PIN.url}/forgot-password`, { resourceType: () => "document", isNavigationRequest: () => true }],
  ["https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", { method: () => "POST", resourceType: () => "xhr" }],
  [FEEDBACK_RESOURCE, { resourceType: () => "document", isNavigationRequest: () => true, redirectedFrom: () => ({}) }],
];
for (const [url, overrides] of deniedCases) {
  const test = scenario(); const request = test.request({ url: () => url, ...overrides }); test.observe(request, false);
  const code = await fatal(test, request);
  eq(test.observer.first.NETWORK_DECISION, "BLOCKED"); eq(test.observer.first.CAPTURE_CONTROL, "FATAL");
  eq(test.observer.first.BEFORE_TRANSMISSION, true); eq(test.observer.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION");
  eq(test.journal.first.CODE, code); eq(test.actions.at(-1), "ABORT"); eq(test.downstream, []);
  eq(test.observer.first.BODY_PRESENT, "UNKNOWN"); eq(test.reads, { headers: 0, bodies: 0 });
  eq(test.output.join("\n").includes(secret), false);
}
console.log("UNKNOWN_PRODUCTION_RSC_FORGOT_AUTH_API_REMAIN_FATAL=PASS");

// Body presence only; headers are privately classified. Values/IDs never emitted.
for (const name of ["authorization", "cookie", "x-api-key", "x-vercel-trusted-oidc-idp-token", "next-action"]) {
  const test = scenario(); const request = test.request({
    headersArray: async () => [{ name, get value() { throw Error("SECRET_VALUE_READ"); } }],
    postDataBuffer: () => new Proxy({}, { get() { throw Error("BODY_CONTENT_READ"); } }),
  });
  test.observe(request); await fatal(test, request);
  eq(test.observer.first.BODY_PRESENT, true);
  eq(test.observer.first.SESSION_REQUIRED_MATERIAL_PRESENT, "UNKNOWN");
  if (name !== "next-action") eq(test.observer.first.CREDENTIAL_METADATA_PRESENT, true);
  else eq(test.observer.first.SERVER_ACTION, true);
  eq(test.output.join("\n").includes(secret), false);
}
const unavailable = scenario({ arm: false, production: "UNKNOWN" });
const bad = unavailable.request({ headersArray: async () => { throw Error(secret); }, postDataBuffer: () => { throw Error(secret); } });
unavailable.observe(bad, false); await fatal(unavailable, bad);
for (const key of ["BODY_PRESENT", "CREDENTIAL_METADATA_PRESENT", "SESSION_REQUIRED_MATERIAL_PRESENT", "INITIATOR_TYPE", "SINGLE_OCCURRENCE", "PRODUCTION_EXCLUSION_VERIFIED"]) eq(unavailable.observer.first[key], "UNKNOWN");
eq(unavailable.observer.first.COUNT_COMPLETE, false);
const timeout = scenario(); const timeoutRequest = timeout.request({ headersArray: () => new Promise(() => {}) });
timeout.observe(timeoutRequest); await fatal(timeout, timeoutRequest);
eq(timeout.observer.first.CREDENTIAL_METADATA_PRESENT, "UNKNOWN"); eq(timeout.actions.at(-1), "ABORT");
const foreign = scenario(); const foreignRequest = foreign.request();
foreign.observe(foreignRequest, foreign.event({ initiator: { type: "script", stack: { callFrames: [{ url: `https://unknown.invalid/${secret}` }] } } }));
await fatal(foreign, foreignRequest);
eq(foreign.observer.first.INITIATOR_FOREIGN_SOURCE, true); eq(foreign.observer.first.INITIATOR_ATTRIBUTION_VERIFIED, false);
const duplicate = scenario(); const duplicateOne = duplicate.request(); const duplicateTwo = duplicate.request();
duplicate.observe(duplicateOne); duplicate.observe(duplicateTwo, duplicate.event({ requestId: "PRIVATE_SECOND" }));
await fatal(duplicate, duplicateTwo);
eq(duplicate.observer.first.EXACT_OCCURRENCE, 2); eq(duplicate.observer.first.SINGLE_OCCURRENCE, false); eq(duplicate.observer.first.COUNT_COMPLETE, true);
eq(duplicate.observer.first.INITIATOR_CORRELATED, false);
console.log("FIVE_FACTS_REQUIRE_POSITIVE_METADATA_MISSING_STAYS_UNKNOWN=PASS");

// A winning asynchronous capture survives cleanup; concurrent writers and a
// throwing sink cannot replace it or change the original fatal/abort behavior.
const racing = scenario(); const gate = deferred();
const raceRequest = racing.request({ headersArray: () => gate.promise }); racing.observe(raceRequest);
const raceRun = fatal(racing, raceRequest, () => { throw Error(secret); });
await tick(); racing.observer.freeze(); racing.journal.seal();
eq(await racing.observer.capture(raceRequest, originalBase), null);
gate.resolve([]); await raceRun; await racing.observer.settle();
eq(racing.observer.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION");
eq(racing.observer.first.CAPTURE_CONTROL, "FATAL"); eq(racing.actions.at(-1), "ABORT");
eq(racing.output.join("\n").includes(secret), false);
const unsafe = { ...preserved, body: secret, email: secret, headers: secret, password: secret, GUARD_RULE: secret, FIRST_FAILED_PREDICATE: secret, ORIGINAL_LIFECYCLE_PHASE: secret, INITIATOR_TYPE: secret, BODY_PRESENT: secret, EXACT_OCCURRENCE: secret };
const safe = sanitizePreauthenticationFatalMetadata(unsafe);
eq(safe.BODY_PRESENT, "UNKNOWN"); eq(safe.GUARD_RULE, "UNKNOWN"); eq(safe.ORIGINAL_LIFECYCLE_PHASE, "UNKNOWN");
eq(JSON.stringify(safe).includes(secret), false);
for (const record of [preserved, foreign.observer.first, safe, unavailable.observer.first, racing.observer.first]) {
  for (const line of preauthenticationFatalMetadataLines(record)) { assert.match(line, /^P7_PREAUTH_FATAL_[A-Z0-9_]+=[A-Z0-9_]+$/); checks++; }
  const encoded = JSON.stringify(record) + preauthenticationFatalMetadataLines(record).join("\n");
  for (const value of [secret, "PRIVATE_REQUEST", "PRIVATE_FRAME", "PRIVATE_SECOND"]) eq(encoded.includes(value), false);
}
console.log("REDACTION_TIMEOUT_CLEANUP_AND_SINK_FAILURE_PRESERVE_FATAL=PASS");

// Adapter permits ONLY passive Page/Network notifications, never input/evaluate.
const adapterTest = scenario(); const commands = []; const handlers = new Map(); const requests = new Map();
adapterTest.page.context = () => ({
  on: (name, handler) => requests.set(name, handler),
  newCDPSession: async () => ({ on: (name, handler) => handlers.set(name, handler), send: async name => commands.push(name) }),
});
const adapter = await attachPreauthenticationFatalMetadata(adapterTest.page, PIN, false, adapterTest.boundary.requestPhase, () => adapterTest.boundary.lifecyclePhase);
eq(commands, ["Page.enable", "Network.enable"]);
const adapterRequest = adapterTest.request(); adapterTest.boundary.observe(adapterRequest);
handlers.get("Page.frameNavigated")({ frame: { id: "PRIVATE_FRAME" } });
requests.get("request")(adapterRequest); handlers.get("Network.requestWillBeSent")(adapterTest.event());
eq((await adapter.capture(adapterRequest, originalBase)).INITIATOR_CORRELATED, true);
adapter.freeze(); await adapter.settle(); eq(adapter.active, false);
console.log("PASSIVE_ADAPTER_NO_INPUT_NO_NETWORK_COMMANDS=PASS");

const readSource = path => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const source = readSource("./protected-preview-preauth-fatal-metadata.mjs");
const runner = readSource("../phase6/hosted-auth-smoke.mjs");
assert.doesNotMatch(source, /route\.(continue|abort|fulfill)|\.evaluate\(|evaluateHandle|\.click\(|\.goto\(|\.fill\(|CredRead|submitStarted\(|requestInFlight\(|NONFATAL_IRRELEVANT_BLOCK|\.postData\(|\.postDataJSON\(/); checks++;
assert.match(runner, /preauthenticationObserver = await attachPreauthenticationFatalMetadata\(page, PIN, before.feedbackProductionRelationship, captureBoundary.requestPhase, \(\) => captureBoundary.lifecyclePhase\)/); checks++;
assert.match(runner, /check\(\); demand\(lifecyclePhase === from,[\s\S]*if \(from === "PRE_AUTHENTICATION"\) freezePreauthenticationEvidence\(\);\s*lifecyclePhase = to/); checks++;
assert.match(runner, /freezePreauthenticationEvidence: \(\) => \{ preauthenticationPolicy\?\.freeze\(\); preauthenticationObserver\?\.freeze\(\); \}/); checks++;
assert.match(runner, /await abortWithFirstRefusal\(firstRefusal, request, error,[\s\S]*await preauthenticationObserver\?\.capture\(request, firstRefusal.first,[\s\S]*await feedbackObserver\?\.capture\(request/); checks++;
eq(runner.indexOf("attachPreauthenticationFatalMetadata(page,") < runner.indexOf('const login = await step(() => go("/login"))'), true);
// Immutable pre-edit bytes: policies, auth collector, launcher and historical
// hosted successes are not altered to obtain a local PASS.
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
for (const [path, expected] of [
  ["./protected-preview-feedback-metadata.mjs", "1d4835ec95119311a6fdcafa8d3e6a99dc7adea6240954efa8b0c16660e4da5c"],
  ["./protected-preview-capture.mjs", "fc67a03cb4ff62b1b18976c510ee846aa7b0708906b53eb91b7b57656db79c87"],
  ["./protected-preview-toolbar-policy.mjs", "207145bbda5de795e0eeb296dfc36a27109c022411d076f62f846afe302f5966"],
  ["./protected-preview-rsc-policy.mjs", "6fb835b86bfc4116144d567d1177f0ec455b34ee005f585ad28497d911dd9d97"],
  ["./protected-preview-forgot-policy.mjs", "b507be714523edfd31d160afd1dd950ea28014e2f3d7cff4d5eda6f7132fb19a"],
  ["../../tools/run-phase6-hosted-smoke.ps1", "69ca4a43267051ec03c0d8b70a09576c7cdd77b9b9265a6a11f49d3d4b4327e8"],
  ["../../docs/phase7-authentication-metadata-capture-20260914T111811Z.json", "31dce14799bb87604003f5f91954daa76a190b881bcd6ce5be7f0b050df14d60"],
]) eq(hash(readFileSync(new URL(path, import.meta.url))), expected);
const evidenceBytes = readFileSync(new URL("../../docs/phase7-vercel-automated-access-evidence.json", import.meta.url));
eq(hash(evidenceBytes), "eb902d467d76332894051ed2f3807bead33ddcdc0fda3bf1bd7f11d5d81f74cf");
const evidence = JSON.parse(evidenceBytes);
for (const attempt of [evidence.latestAttempt, evidence.previousSuccessfulAuthenticationAttempt]) {
  eq(attempt.results.salespersonAAuthentication, "PASS"); eq(attempt.results.dashboardReachedAfterLogin, "PASS");
}
console.log("POLICIES_AND_PREVIOUS_AUTH_DASHBOARD_EVIDENCE_UNCHANGED=PASS");
console.log(`Preauthentication fatal-only metadata regressions: PASS (${checks} checks; hosted requests: 0; credential reads: 0).`);
