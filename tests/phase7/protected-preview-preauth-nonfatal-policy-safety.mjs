// Local request/CDP doubles + the ACTUAL interception callback. No browser,
// credentials, provider CLI, network transport or hosted access is invoked.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";
import { setImmediate as tick } from "node:timers/promises";
import { PIN, assertRequest, assertProof, assertOidcClaims, safeCode, abortWithFirstRefusal,
  createFirstRefusalJournal, createAuthenticationCaptureBoundary } from "../phase6/hosted-auth-smoke.mjs";
import { FEEDBACK_RESOURCE, AUTHENTICATION_LIFECYCLE, createFeedbackMetadataObserver, feedbackMetadataLines } from "./protected-preview-feedback-metadata.mjs";
import { createPreauthenticationFatalMetadataObserver, preauthenticationFatalMetadataLines } from "./protected-preview-preauth-fatal-metadata.mjs";
import { createPreauthenticationNonfatalPolicy, exactPreauthenticationFacts, preauthenticationNonfatalLines, isPreauthenticationBlockReceipt } from "./protected-preview-preauth-nonfatal-policy.mjs";

let checks = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const pass = label => console.log(`${label}=PASS`);
const secret = "PRIVATE_SYNTHETIC_SENTINEL_NEVER_EMIT";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const source = read("../phase6/hosted-auth-smoke.mjs");
const callbackStart = source.indexOf('await context.route("**/*", ');
const callbackEnd = source.indexOf('\n    const page = await context.newPage();', callbackStart);
const callback = source.slice(callbackStart + 'await context.route("**/*", '.length, callbackEnd).trim().replace(/\);$/, "");
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function clockFixture() {
  let time = 0; let serial = 0; const timers = new Map();
  return { now: () => time, setTimeout(fn, ms) { const id = ++serial; timers.set(id, { fn, at: time + ms }); return id; },
    clearTimeout(id) { timers.delete(id); }, advance(ms) { time += ms; for (const [id, item] of timers) if (item.at <= time) { timers.delete(id); item.fn(); } },
    get count() { return timers.size; } };
}
function scenario(options = {}) {
  const output = []; const transport = []; const downstream = []; const clock = clockFixture();
  const evaluations = []; const networkEvents = []; // Local object identity, never hosted evidence.
  let policy; let observer; let scope; let reads = 0;
  const proof = { ...PIN, checkedAt: Date.now(), ...options.proof };
  const now = Date.now() / 1000;
  const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`,
    owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId,
    environment: "development", sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`,
    iat: now, exp: now + 3600, ...options.claims };
  const journal = createFirstRefusalJournal(record => output.push(`FATAL=${record.CODE}`));
  const boundary = createAuthenticationCaptureBoundary(options.enabled !== false, {
    clock, publish: (key, value) => output.push(`P7_${key}=${value}`),
    freezePreauthenticationEvidence: () => { policy.freeze(); observer.freeze(); },
    sealEvidence: () => { journal.seal(); observer.freeze(); },
    preauthenticationBlockReceipt: () => options.receipt === undefined ? policy.first : options.receipt,
  });
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  observer = createPreauthenticationFatalMetadataObserver(page, PIN, options.production ?? false,
    boundary.requestPhase, () => boundary.lifecyclePhase);
  const auth = createFeedbackMetadataObserver(page, PIN, false, boundary.requestPhase);
  for (const sink of [observer, auth]) {
    if (options.armed !== false) sink.arm(); sink.frameNavigated({ frame: { id: "PRIVATE_FRAME" } });
  }
  policy = createPreauthenticationNonfatalPolicy({ pin: PIN, phase: () => boundary.lifecyclePhase,
    requestPhase: boundary.requestPhase, hasFatal: () => !!scope?.policyFailure || !!journal.first || boundary.stopped,
    verifyTargetAndOidc: () => { assertProof(proof); assertOidcClaims(claims); return true; },
    inspect: async (request, details) => {
      reads++; if (options.inspectGate) await options.inspectGate;
      const facts = await observer.inspect(request, details);
      return options.facts ? { ...facts, ...options.facts } : facts;
    },
    publish: record => { if (options.sinkFailure) throw Error(secret); output.push(...preauthenticationNonfatalLines(record)); },
  });
  scope = { diagnosticContext: lifecyclePhase => ({ phase: "BROWSER_ACCESS", lifecyclePhase }),
    captureBoundary: boundary, currentProof: proof, oidc: { claims, token: secret },
    assertRequest, assertOidcClaims, safeCode, preauthenticationPolicy: policy,
    policyFailure: undefined, loginPermit: false, loginPosts: 0,
    demand: (condition, code) => { if (!condition) throw Error(code); },
    firstRefusal: journal, abortWithFirstRefusal, preauthenticationObserver: observer, feedbackObserver: auth,
    preauthenticationFatalMetadataLines, feedbackMetadataLines, console: { log: line => output.push(line) },
  };
  const routeHandler = vm.runInNewContext(`(${callback})`, scope);
  const request = (overrides = {}) => ({ url: () => FEEDBACK_RESOURCE, method: () => "GET", resourceType: () => "script",
    frame: () => frame, isNavigationRequest: () => false, redirectedFrom: () => null, serviceWorker: () => null,
    headers: () => ({}), headersArray: async () => [{ name: "referer", value: `${PIN.url}/login` }], postDataBuffer: () => null,
    postData() { throw Error("BODY_CONTENT_READ_FORBIDDEN"); }, postDataJSON() { throw Error("BODY_CONTENT_READ_FORBIDDEN"); }, ...overrides });
  let eventSerial = 0;
  const observe = (req, eventOverrides = {}) => {
    boundary.observe(req); observer.observe(req); auth.observe(req);
    const event = { requestId: `PRIVATE_REQUEST_${++eventSerial}`, frameId: "PRIVATE_FRAME", documentURL: `${PIN.url}/login`,
      type: "Script", request: { url: req.url(), method: req.method() },
      initiator: { type: "script", stack: { callFrames: [{ url: `${PIN.url}/_next/static/chunks/app.js` }] } }, ...eventOverrides };
    for (const sink of [observer, auth]) sink.requestWillBeSent(event);
  };
  const dispatch = (req, options = {}) => {
    evaluations.push(req);
    return routeHandler({ request: () => req,
      abort: async () => {
        transport.push("BLOCKED"); networkEvents.push({ request: req, phase: boundary.requestPhase(req), event: "BLOCKED" });
        if (options.abortFailure) throw Error(secret); if (options.abortGate) await options.abortGate;
      },
      continue: async () => transport.push("TRANSMITTED_APPROVED_TARGET"), fulfill: async () => { throw Error("FULFILL_FORBIDDEN"); } });
  };
  return { policy, observer, auth, boundary, journal, request, observe, dispatch, output, transport, evaluations, networkEvents, clock, downstream, scope,
    get reads() { return reads; },
    run: authenticate => boundary.run(authenticate, async () => { downstream.push("FINAL_SALESPERSON_REPORTS_ISOLATION"); }).then(() => "RETURNED", safeCode) };
}

const first = scenario(); const req = first.request(); first.observe(req);
eq(first.boundary.authenticationCollectorActive, false);
await first.dispatch(req);
eq(first.transport, ["BLOCKED"]); eq(first.journal.first, null); eq(first.observer.first, null); eq(first.auth.first, null);
eq(first.policy.first.CAPTURE_CONTROL, "NONFATAL_IRRELEVANT_BLOCK"); eq(first.policy.first.NETWORK_DECISION, "BLOCKED");
eq(first.policy.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION"); eq(exactPreauthenticationFacts(first.policy.first), true);
eq(Object.hasOwn(first.policy.first, "FIRST_FATAL_REFUSAL"), false); eq(Object.isFrozen(first.policy.first), true);
eq(isPreauthenticationBlockReceipt(first.policy.first, req), true);
eq(isPreauthenticationBlockReceipt({ ...first.policy.first }, req), false);
eq(first.policy.first.RECORD, "PREAUTH_NONFATAL_IRRELEVANT_BLOCK");
pass("FIRST_EXACT_PREAUTH_BLOCKED_NONFATAL"); pass("APPROVED_REQUEST_NOT_TRANSMITTED"); pass("NONFATAL_EVIDENCE_SEPARATE");

// Every required field is independently mandatory; false, UNKNOWN, missing,
// wrong-typed and throwing properties cannot be treated as positive evidence.
const validFacts = first.policy.first;
for (const [key, value] of Object.entries(validFacts)) {
  if (["RECORD", "RESOURCE", "INITIATING_PAGE", "UTC_EPOCH_MS", "NETWORK_DECISION", "CAPTURE_CONTROL"].includes(key)) continue;
  for (const invalid of [undefined, null, "UNKNOWN", typeof value === "boolean" ? !value : "WRONG", {}]) {
    eq(exactPreauthenticationFacts({ ...validFacts, [key]: invalid }), false);
  }
}
eq(exactPreauthenticationFacts(new Proxy({}, { get() { throw Error(secret); } })), false);
pass("UNKNOWN_PREDICATE_FATAL");

const receipt = first.policy.first;
const second = first.request({ headers: () => ({ "next-router-prefetch": "1" }) }); first.observe(second);
await first.dispatch(second);
eq(first.transport, ["BLOCKED", "BLOCKED"]); eq(first.policy.first, receipt);
eq(first.journal.first.CODE, "OFF_TARGET_REQUEST_BLOCKED"); eq(first.journal.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION");
eq(first.observer.first.CAPTURE_CONTROL, "FATAL"); eq(first.auth.first, null);
eq(first.observer.first.EXACT_OCCURRENCE, 2); eq(first.observer.first.COUNT_COMPLETE, true);
eq(first.evaluations, [req, second]); eq(first.networkEvents.map(event => event.request), [req, second]);
eq(new Set(first.networkEvents.map(event => event.request)).size, 2);
const fatalRecord = first.journal.first; first.journal.seal(); first.observer.freeze(); await first.observer.settle();
const later = first.request({ url: () => "https://unknown.invalid/later" }); first.observe(later); await first.dispatch(later);
eq(first.journal.first, fatalRecord); eq(first.policy.first, receipt);
assert.throws(() => { fatalRecord.CODE = "PASS"; }, TypeError); checks++;
pass("SECOND_OCCURRENCE_FATAL"); pass("LATER_FATAL_CAPTURED"); pass("CLEANUP_CANNOT_OVERWRITE_FATAL");

// Regression for the reviewed failure: FIRST exact occurrence, with a deliberately
// failing nonfatal evidence sink AFTER a successful abort. Fatality must survive,
// but must not issue/record a second network abort for that same request.
const sinkFailure = scenario({ sinkFailure: true }); const sinkRequest = sinkFailure.request();
sinkFailure.observe(sinkRequest);
const sinkRun = sinkFailure.run(async step => { await step(() => new Promise(() => {})); });
await tick(); await sinkFailure.dispatch(sinkRequest);
eq(await sinkRun, "OFF_TARGET_REQUEST_BLOCKED");
eq(sinkFailure.transport, ["BLOCKED"]); eq(sinkFailure.evaluations, [sinkRequest]);
eq(sinkFailure.networkEvents, [{ request: sinkRequest, phase: "PRE_AUTHENTICATION", event: "BLOCKED" }]);
eq(sinkFailure.policy.first, null); eq(sinkFailure.observer.first.EXACT_OCCURRENCE, 1);
eq(sinkFailure.observer.first.COUNT_COMPLETE, true); eq(sinkFailure.observer.first.SINGLE_OCCURRENCE, true);
eq(sinkFailure.observer.first.CAPTURE_CONTROL, "FATAL"); eq(sinkFailure.auth.first, null);
eq(sinkFailure.journal.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION");
eq(sinkFailure.output.filter(line => line === "FATAL=OFF_TARGET_REQUEST_BLOCKED").length, 1);
eq(sinkFailure.output.includes("P7_AUTHENTICATION_METADATA_CAPTURE=FIRST_FATAL_CAPTURED"), true);
eq(sinkFailure.output.some(line => line.startsWith("P7_PREAUTH_NONFATAL_")), false);
eq(sinkFailure.output.join("\n").includes(secret), false); eq(sinkFailure.downstream, []);
eq(sinkFailure.boundary.stopped, true);
const sinkFatal = sinkFailure.journal.first;
sinkFailure.journal.seal(); sinkFailure.observer.freeze(); await sinkFailure.observer.settle();
eq(sinkFailure.journal.first, sinkFatal); eq(Object.isFrozen(sinkFatal), true);
pass("ONE_LOGICAL_REQUEST_ONE_BLOCK_EVENT"); pass("FATAL_FALLBACK_TERMINATES");
pass("FATAL_TERMINATION_SEPARATE_FROM_ABORT"); pass("OCCURRENCE_COUNT_CORRECT");

async function refused(label, requestOverrides = {}, scenarioOptions = {}, eventOverrides = {}) {
  const test = scenario(scenarioOptions); const value = test.request(requestOverrides); test.observe(value, eventOverrides);
  await test.dispatch(value);
  eq(test.transport, ["BLOCKED"]); eq(test.policy.first, null); eq(!!test.journal.first, true);
  eq(test.boundary.stopped, true); eq(test.output.join("\n").includes(secret), false);
  pass(label);
}
for (const [label, overrides, config, event] of [
  ["DIFFERENT_PATH_FATAL", { url: () => "https://vercel.live/_next-live/feedback/other.js", headers: () => ({ "next-router-prefetch": "1" }) }],
  ["DIFFERENT_ORIGIN_FATAL", { url: () => "https://unknown.invalid/_next-live/feedback/feedback.js" }],
  ["NAVIGATION_FATAL", { isNavigationRequest: () => true }],
  ["DOCUMENT_FATAL", { resourceType: () => "document" }],
  ["FORM_FATAL", { method: () => "POST", isNavigationRequest: () => true }],
  ["REDIRECT_FATAL", { redirectedFrom: () => ({}) }],
  ["AUTH_API_FATAL", { url: () => "https://vercel.live/auth/token" }],
  ["SUPABASE_AUTH_FATAL", { url: () => "https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", method: () => "POST" }],
  ["APPLICATION_LOGIN_API_FATAL", { url: () => `${PIN.url}/api/login`, method: () => "POST" }],
  ["BODY_MISMATCH_FATAL", { postDataBuffer: () => Buffer.from(secret) }],
  ["CREDENTIAL_METADATA_MISMATCH_FATAL", { headersArray: async () => [{ name: "authorization", value: secret }] }],
  ["SESSION_MATERIAL_MISMATCH_FATAL", { headersArray: async () => [{ name: "cookie", value: secret }] }],
  ["PRODUCTION_FATAL", { url: () => "https://fulfillment-management-platform.vercel.app/login", headers: () => ({ "next-router-prefetch": "1" }) }],
  ["UNKNOWN_EXTERNAL_FATAL", { url: () => "https://unknown.invalid/path" }],
  ["FETCH_XHR_FATAL", { resourceType: () => "fetch" }],
  ["RSC_MISMATCH_FATAL", { url: () => FEEDBACK_RESOURCE + "?_rsc=opaque", headers: () => ({ "next-router-prefetch": "1" }) }],
  ["SERVICE_WORKER_FATAL", { serviceWorker: () => ({}) }],
  ["UNKNOWN_HEADER_FATAL", { headersArray: async () => [{ name: "x-unknown", value: secret }] }],
  ["HEADER_TIMEOUT_FATAL", { headersArray: () => new Promise(() => {}) }],
  ["UNKNOWN_PRODUCTION_RELATION_FATAL", {}, { production: "UNKNOWN" }],
  ["PRODUCTION_RELATION_FATAL", {}, { production: true }],
  ["UNARMED_OBSERVER_FATAL", {}, { armed: false }],
  ["PARSER_NEAR_MATCH_FATAL", {}, {}, { initiator: { type: "parser", url: `${PIN.url}/login` } }],
  ["FOREIGN_INITIATOR_FATAL", {}, {}, { initiator: { type: "script", url: `https://unknown.invalid/${secret}` } }],
  ["TARGET_PROOF_EXPIRED_FATAL", {}, { proof: { checkedAt: Date.now() - 600001 } }],
  ["OIDC_EXPIRED_FATAL", {}, { claims: { exp: 1 } }],
  ["EVIDENCE_SINK_FAILURE_FATAL", {}, { sinkFailure: true }],
  ["WRONG_MAIN_FRAME_FATAL", { frame: () => ({ url: () => `${PIN.url}/login`, page: () => ({}) }) }],
]) await refused(label, overrides, config, event);
for (const field of ["AUTHENTICATION_API", "SUPABASE_AUTH", "APPLICATION_API_REQUIRED_FOR_LOGIN", "SESSION_REQUIRED_MATERIAL_PRESENT", "RSC_QUERY_PRESENT"]) {
  await refused(`FACT_${field}_FATAL`, {}, { facts: { [field]: true } });
}
for (const url of [FEEDBACK_RESOURCE + "#fragment", FEEDBACK_RESOURCE + "?query=x", FEEDBACK_RESOURCE.replace("https:", "http:"), FEEDBACK_RESOURCE.replace("https://", "https://user@"), FEEDBACK_RESOURCE.replace("vercel.live", "vercel.live:444"), FEEDBACK_RESOURCE.replace("vercel.live", "vercel.live:443")]) {
  await refused("RAW_IDENTITY_NEAR_MATCH_FATAL", { url: () => url });
}

for (const phase of AUTHENTICATION_LIFECYCLE.slice(1)) {
  const test = scenario(); const value = test.request();
  test.boundary.submitStarted();
  if (phase !== "AUTHENTICATION_SUBMIT_STARTED") test.boundary.requestInFlight();
  if (["AUTHENTICATION_SUCCEEDED", "POST_AUTHENTICATION"].includes(phase)) {
    // Direct controller test of immutable original phase; no hosted lifecycle.
    const policy = createPreauthenticationNonfatalPolicy({ pin: PIN, phase: () => phase, requestPhase: () => phase,
      hasFatal: () => false, verifyTargetAndOidc: () => true, inspect: async () => validFacts });
    eq(await policy.tryBlocked(value, "OFF_TARGET_REQUEST_BLOCKED", true, async () => {}), false);
  } else {
    test.observe(value); await test.dispatch(value); eq(test.policy.first, null); eq(test.transport, ["BLOCKED"]);
  }
}
const missing = scenario(); await missing.dispatch(missing.request()); eq(missing.policy.first, null); eq(missing.transport, ["BLOCKED"]);
pass("OUTSIDE_PREAUTH_NOT_ELIGIBLE");

// Atomic budget, pending submit barrier, fatal racing metadata, and abort/sink
// failure: none can create a receipt, reset budget or transmit the request.
const hold = deferred(); const race = scenario({ inspectGate: hold.promise });
const one = race.request(); race.observe(one); const work = race.dispatch(one);
eq(race.policy.pending, true); assert.throws(() => race.boundary.submitStarted(), /PREAUTH_CLASSIFICATION_PENDING/); checks++;
eq(race.boundary.lifecyclePhase, "PRE_AUTHENTICATION");
const two = race.request(); race.observe(two); await race.dispatch(two);
hold.resolve(); await work; await race.policy.settle();
eq(race.policy.first, null); eq(race.transport, ["BLOCKED", "BLOCKED"]); eq(race.policy.pending, false);
const aborted = scenario(); const abortRequest = aborted.request(); aborted.observe(abortRequest);
await aborted.dispatch(abortRequest, { abortFailure: true });
eq(aborted.policy.first, null); eq(!!aborted.journal.first, true); eq(aborted.transport, ["BLOCKED"]);
eq(aborted.networkEvents.length, 1); eq(aborted.networkEvents[0].request, abortRequest);
const lateHold = deferred(); let livePhase = "PRE_AUTHENTICATION";
const latePolicy = createPreauthenticationNonfatalPolicy({ pin: PIN, phase: () => livePhase, requestPhase: () => "PRE_AUTHENTICATION",
  hasFatal: () => false, verifyTargetAndOidc: () => true, inspect: () => lateHold.promise });
const lateWork = latePolicy.tryBlocked(req, "OFF_TARGET_REQUEST_BLOCKED", true, async () => { throw Error("MUST_NOT_ABORT_NONFATAL"); });
livePhase = "AUTHENTICATION_SUBMIT_STARTED"; lateHold.resolve(validFacts);
eq(await lateWork, false); eq(latePolicy.first, null);
pass("ATOMIC_BUDGET_PHASE_RACE_AND_ABORT_FAILURE_FATAL");

// Account the branded receipt for the SAME observed request, never a forged
// receipt or an auth-phase occurrence. Both modes retain their original boundary.
for (const enabled of [true, false]) {
  const test = scenario({ enabled }); const value = test.request(); test.observe(value); await test.dispatch(value);
  const preserved = test.policy.first;
  eq(test.observer.active, true); eq(test.boundary.authenticationCollectorActive, false); eq(test.auth.first, null);
  const running = test.run(async () => {
    await test.policy.settle(); test.boundary.submitStarted();
    eq(test.observer.active, false); eq(test.boundary.authenticationCollectorActive, true);
    eq(test.boundary.requestPhase(value), "PRE_AUTHENTICATION");
    eq(await test.auth.capture(value), null);
    test.boundary.requestInFlight(); test.boundary.beginObservation();
  });
  await tick(); if (enabled) { eq(test.clock.count, 1); test.clock.advance(30000); }
  eq(await running, "RETURNED"); eq(test.policy.first, preserved);
  eq(test.downstream, enabled ? [] : ["FINAL_SALESPERSON_REPORTS_ISOLATION"]);
  if (enabled) {
    eq(test.output.includes("P7_FEEDBACK_REQUEST_OBSERVED=YES"), true);
    eq(test.output.includes("P7_AUTH_PHASE_FEEDBACK_REQUEST_OBSERVED=NO"), true);
    eq(test.output.includes("P7_AUTHENTICATION_METADATA_CAPTURE=AUTH_SUCCESS_WITH_PREAUTH_BLOCK"), true);
    eq(test.output.includes("P7_AUTHENTICATION_METADATA_CAPTURE=NO_FEEDBACK_AUTH_SUCCESS"), false);
  }
}
pass("PREAUTH_OBSERVER_LIFECYCLE"); pass("AUTH_COLLECTOR_PREAUTH_INACTIVE"); pass("AUTH_COLLECTOR_SUBMIT_ACTIVATION");
pass("AUTH_CAPTURE_STOP_BOUNDARY_PRESERVED"); pass("NORMAL_FINAL_VERIFICATION_FLOW_PRESERVED");

for (const receipt of [{ ...first.policy.first }, first.policy.first]) {
  const test = scenario({ receipt }); const value = test.request(); test.observe(value);
  const running = test.run(async () => { test.boundary.submitStarted(); test.boundary.requestInFlight(); test.boundary.beginObservation(); });
  await tick(); test.clock.advance(30000); eq(await running, "FEEDBACK_OBSERVED_WITHOUT_FATAL"); eq(test.downstream, []);
}
const laterFatal = scenario(); const preRequest = laterFatal.request(); laterFatal.observe(preRequest); await laterFatal.dispatch(preRequest);
const preservedNonfatal = laterFatal.policy.first;
const running = laterFatal.run(async step => { laterFatal.boundary.submitStarted(); laterFatal.boundary.requestInFlight(); laterFatal.boundary.beginObservation(); await step(() => new Promise(() => {})); });
await tick(); const fatalAuth = laterFatal.request(); laterFatal.observe(fatalAuth); await laterFatal.dispatch(fatalAuth);
eq(await running, "OFF_TARGET_REQUEST_BLOCKED"); eq(laterFatal.policy.first, preservedNonfatal);
eq(laterFatal.journal.first.ORIGINAL_LIFECYCLE_PHASE, "AUTHENTICATION_REQUEST_IN_FLIGHT");
eq(laterFatal.observer.first, null); eq(laterFatal.auth.first.ORIGINAL_LIFECYCLE_PHASE, "AUTHENTICATION_REQUEST_IN_FLIGHT");
eq(laterFatal.auth.first.EXACT_OCCURRENCE, 2); eq(laterFatal.auth.first.AUTHENTICATION_OCCURRENCE, 1);
eq(laterFatal.downstream, []); pass("NONFATAL_DOES_NOT_MASK_LATER_AUTH_FATAL");

for (const path of ["/login", "/dashboard", "/salespeople", "/reports?_rsc=opaque", "/_next/static/chunks/a.js"]) {
  const test = scenario(); const value = test.request({ url: () => PIN.url + path }); test.observe(value); await test.dispatch(value);
  eq(test.transport, ["TRANSMITTED_APPROVED_TARGET"]); eq(test.policy.first, null); eq(test.journal.first, null);
}
const prefetch = scenario(); const allowedPrefetch = prefetch.request({ url: () => `${PIN.url}/reports?_rsc=x`, headers: () => ({ "next-router-prefetch": "1" }) });
prefetch.observe(allowedPrefetch); await prefetch.dispatch(allowedPrefetch); eq(prefetch.transport, ["BLOCKED"]); eq(prefetch.journal.first, null);
pass("APPROVED_TARGET_BEHAVIOR_PRESERVED");

for (const line of preauthenticationNonfatalLines(first.policy.first)) {
  assert.match(line, /^P7_PREAUTH_NONFATAL_[A-Z0-9_]+=[A-Z0-9_]+$/); checks++;
  eq(line.includes(secret), false);
}
assert.throws(() => preauthenticationNonfatalLines({ ...first.policy.first, token: secret }), /UNVERIFIED_PREAUTH_RECEIPT/); checks++;
eq(JSON.stringify(first.policy.first).includes(secret), false);
const policySource = read("./protected-preview-preauth-nonfatal-policy.mjs");
assert.doesNotMatch(policySource, /route\.(continue|fulfill)|\.evaluate\(|\.click\(|\.goto\(|\.fill\(|CredRead|fetch\(|https\.request/); checks++;
eq(callback.indexOf("assertRequest(currentProof") < callback.indexOf('request.headers()["next-router-prefetch"]'), true);
eq(callback.indexOf("preauthenticationPolicy?.tryBlocked") < callback.indexOf("policyFailure ??="), true);
eq(callback.match(/route\.abort\(\)/g)?.length, 1);
assert.match(callback, /let abortTask;\s*const abortOnce = \(\) => abortTask \?\?= Promise.resolve\(\).then\(\(\) => route.abort\(\)\)/); checks++;
assert.match(callback, /tryBlocked\(request, safeCode\(error\), beforeTransmission, abortOnce\)/); checks++;
assert.match(callback, /await abortWithFirstRefusal[\s\S]*\}, abortOnce\)/); checks++;
eq(source.indexOf("preauthenticationPolicy.settle()") < source.indexOf("captureBoundary.submitStarted()"), true);
pass("SECRET_REDACTION");
const evidence = readFileSync(new URL("../../docs/phase7-vercel-automated-access-evidence.json", import.meta.url));
eq(createHash("sha256").update(evidence).digest("hex"), "eb902d467d76332894051ed2f3807bead33ddcdc0fda3bf1bd7f11d5d81f74cf");
for (const attempt of [JSON.parse(evidence).latestAttempt, JSON.parse(evidence).previousSuccessfulAuthenticationAttempt]) {
  eq(attempt.results.salespersonAAuthentication, "PASS"); eq(attempt.results.dashboardReachedAfterLogin, "PASS");
}
pass("HISTORICAL_AUTHENTICATION_AND_DASHBOARD_EVIDENCE_PRESERVED");
console.log(`Exact preauth blocked/nonfatal regressions: PASS (${checks} checks; hosted requests: 0; credential reads: 0).`);
