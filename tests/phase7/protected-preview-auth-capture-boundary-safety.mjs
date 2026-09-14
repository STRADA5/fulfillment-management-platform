// Local synthetic control flow only: no browser, CLI, credentials or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { setImmediate as tick } from "node:timers/promises";
import { PIN, AUTHENTICATION_OBSERVATION_MS, authenticationCaptureMode, createAuthenticationCaptureBoundary, createFirstRefusalJournal, abortWithFirstRefusal, assertRequest, safeCode } from "../phase6/hosted-auth-smoke.mjs";
import { FEEDBACK_RESOURCE, AUTHENTICATION_LIFECYCLE, createFeedbackMetadataObserver, feedbackMetadataLines } from "./protected-preview-feedback-metadata.mjs";

let checks = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };
const secret = "PRIVATE_SYNTHETIC_SENTINEL_NEVER_EMIT";
const proof = { ...PIN, checkedAt: Date.now() };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fakeClock() {
  let now = 0; let serial = 0; const timers = new Map();
  return {
    now: () => now,
    setTimeout(callback, delay) { const id = ++serial; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(delta) { now += delta; for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.callback(); } },
    get count() { return timers.size; },
  };
}
function scenario(enabled = true) {
  const output = []; const actions = []; const clock = fakeClock();
  let sealed = 0;
  const journal = createFirstRefusalJournal(() => actions.push("FIRST_RECORD"));
  const boundary = createAuthenticationCaptureBoundary(enabled, {
    clock, publish: (key, value) => { output.push(`P7_${key}=${value}`); actions.push(value); },
    sealEvidence: () => { journal.seal(); sealed++; },
  });
  const downstream = [];
  const verifyFinal = async () => {
    for (const phase of ["SALESPERSON_A_IDENTITY", "/salespeople", "ASSIGNED_CLIENT_BOUNDARY", "/reports", "REPORTS_SESSION", "ISOLATION_CHECKS", "PROTECTION_RECHECK", "BOUNDED_CLOSURE"]) downstream.push(phase);
  };
  const run = authenticate => boundary.run(authenticate, verifyFinal).then(() => "RETURNED", error => safeCode(error));
  return { boundary, output, actions, clock, journal, downstream, run, get sealed() { return sealed; } };
}
function requestFixture(test, url = FEEDBACK_RESOURCE) {
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  const request = {
    url: () => url, method: () => "GET", resourceType: () => "script", frame: () => frame,
    isNavigationRequest: () => false, redirectedFrom: () => null, serviceWorker: () => null,
    headersArray: async () => [{ name: "referer", value: `${PIN.url}/login` }], postDataBuffer: () => null,
  };
  const observer = createFeedbackMetadataObserver(page, PIN, false, test.boundary.requestPhase);
  observer.arm(); observer.frameNavigated({ frame: { id: "LOCAL_FRAME" } });
  const observe = () => {
    test.boundary.observe(request); observer.observe(request);
    observer.requestWillBeSent({ requestId: "LOCAL_REQUEST", frameId: "LOCAL_FRAME", documentURL: `${PIN.url}/login`, type: "Script", request: { url, method: "GET" }, initiator: { type: "parser", url: `${PIN.url}/login` } });
  };
  return { request, observer, observe };
}
function submitAndDispatch(test) {
  test.boundary.submitStarted(); test.boundary.requestInFlight();
}
function fatal(test, fixture, metadataGate = Promise.resolve()) {
  let error;
  try { assertRequest(proof, fixture.request.url()); } catch (value) { error = value; }
  assert.ok(error); checks++;
  fixture.observe();
  return test.boundary.firstFatal(safeCode(error), async () => {
    await abortWithFirstRefusal(test.journal, fixture.request, error, {
      phase: "SALESPERSON_A_AUTHENTICATION", lifecyclePhase: test.boundary.requestPhase(fixture.request), beforeTransmission: true,
      captureFeedbackMetadata: async () => {
        await metadataGate;
        await fixture.observer.capture(fixture.request, record => { test.output.push(...feedbackMetadataLines(record)); test.actions.push("METADATA_COMPLETE"); });
      },
    }, async () => { test.actions.push("ABORTED"); });
  });
}

eq(AUTHENTICATION_OBSERVATION_MS, 30000);
eq(authenticationCaptureMode(["--credential-pipe"]), false);
eq(authenticationCaptureMode(["--credential-pipe", "--authentication-metadata-capture"]), true);
for (const args of [["--authentication-metadata-capture"], ["--authentication-metadata-capture", "--credential-pipe", "--config-check"], ["--authentication-metadata-capture", "--credential-pipe", "--preflight-only"]]) {
  assert.throws(() => authenticationCaptureMode(args)); checks++;
}

// First fatal interrupts an in-flight operation BEFORE metadata finishes. The
// terminal outcome is emitted only AFTER metadata and the existing abort finish.
const first = scenario(); const fixture = requestFixture(first); const operation = deferred(); const metadata = deferred();
const firstRun = first.run(async step => {
  submitAndDispatch(first);
  first.boundary.beginObservation();
  await step(() => operation.promise);
  first.actions.push("UNAUTHORIZED_CONTINUATION");
  await step(() => first.actions.push("EXTRA_AUTH_OPERATION"));
});
await tick();
const refusal = fatal(first, fixture, metadata.promise);
eq(first.boundary.stopped, true);
eq(first.journal.first.BEFORE_TRANSMISSION, true);
eq(first.journal.first.CODE, "OFF_TARGET_REQUEST_BLOCKED");
eq(Object.isFrozen(first.journal.first), true);
operation.resolve(); await tick();
eq(first.actions, ["PRE_AUTHENTICATION", "AUTHENTICATION_SUBMIT_STARTED", "AUTHENTICATION_REQUEST_IN_FLIGHT", "FIRST_RECORD"]);
eq(first.downstream, []);
metadata.resolve(); await refusal;
eq(await firstRun, "OFF_TARGET_REQUEST_BLOCKED");
eq(first.actions.indexOf("METADATA_COMPLETE") < first.actions.indexOf("ABORTED"), true);
eq(first.actions.indexOf("ABORTED") < first.actions.indexOf("FIRST_FATAL_CAPTURED"), true);
eq(first.actions.includes("UNAUTHORIZED_CONTINUATION"), false);
eq(first.actions.includes("EXTRA_AUTH_OPERATION"), false);
eq(first.output.includes("P7_CAPTURE_AUTHENTICATION=NOT_COMPLETED"), true);
eq(first.sealed, 1);
eq(fixture.observer.first.NETWORK_DECISION, "BLOCKED");
eq(fixture.observer.first.CAPTURE_CONTROL, "FATAL");
eq(fixture.observer.first.ORIGINAL_LIFECYCLE_PHASE, "AUTHENTICATION_REQUEST_IN_FLIGHT");
eq(first.journal.first.ORIGINAL_LIFECYCLE_PHASE, "AUTHENTICATION_REQUEST_IN_FLIGHT");
eq(first.clock.count, 0);
console.log("FIRST_FATAL_CAPTURE_THEN_STOP=PASS");

const base = JSON.stringify(first.journal.first); const supplement = JSON.stringify(fixture.observer.first);
const historicalNonfatal = Object.freeze({ captureControl: "NONFATAL_IRRELEVANT_BLOCK" });
first.journal.seal(); await fixture.observer.settle(); fixture.observer.seal();
await fatal(first, requestFixture(first, "https://unknown.invalid/"));
eq(JSON.stringify(first.journal.first), base); eq(JSON.stringify(fixture.observer.first), supplement);
eq(historicalNonfatal.captureControl, "NONFATAL_IRRELEVANT_BLOCK");
eq(first.output.filter(x => x === "P7_AUTHENTICATION_METADATA_CAPTURE=FIRST_FATAL_CAPTURED").length, 1);
console.log("FIRST_FATAL_IMMUTABLE_THROUGH_CLEANUP_AND_LATER_EVENTS=PASS");

const clean = scenario(); let successResolved = false;
const cleanRun = clean.run(async step => { submitAndDispatch(clean); clean.boundary.beginObservation(); await step(async () => {}); }).then(value => { successResolved = true; return value; });
await tick(); eq(clean.clock.count, 1); eq(successResolved, false);
clean.clock.advance(29999); await tick(); eq(successResolved, false);
clean.clock.advance(1); eq(await cleanRun, "RETURNED");
eq(clean.output, [
  ...AUTHENTICATION_LIFECYCLE.slice(0, 4).map(value => `P7_AUTH_LIFECYCLE_PHASE=${value}`),
  "P7_FEEDBACK_REQUEST_OBSERVED=NO", "P7_AUTH_PHASE_FEEDBACK_REQUEST_OBSERVED=NO", "P7_NO_FATAL_REQUEST_CAPTURED=YES",
  "P7_CAPTURE_AUTHENTICATION=PASS", "P7_AUTHENTICATION_METADATA_CAPTURE=NO_FEEDBACK_AUTH_SUCCESS",
]);
eq(clean.boundary.lifecyclePhase, "AUTHENTICATION_SUCCEEDED");
eq(clean.downstream, []); eq(clean.clock.count, 0); eq(clean.sealed, 1);
console.log("NO_FEEDBACK_AUTH_SUCCESS_THEN_STOP=PASS");

const failed = scenario(); let attempts = 0;
eq(await failed.run(async step => { submitAndDispatch(failed); attempts++; await step(async () => { throw Error(secret); }); }), "UNEXPECTED_RUNNER_ERROR");
eq(attempts, 1); eq(failed.downstream, []); eq(failed.sealed, 1);
eq(failed.output.includes("P7_CAPTURE_AUTHENTICATION=FAIL"), true);
eq(failed.output.includes("P7_AUTHENTICATION_METADATA_CAPTURE=AUTHENTICATION_FAILED"), true);
eq(failed.output.join("\n").includes(secret), false);
console.log("AUTH_FAILURE_THEN_STOP_NO_RETRY=PASS");

// Fatal during the remaining observation window preserves completed auth, cancels
// its timer and ends immediately rather than waiting for the rest of the window.
const late = scenario();
const lateRun = late.run(async () => { submitAndDispatch(late); late.boundary.beginObservation(); });
await tick(); eq(late.clock.count, 1);
const lateFixture = requestFixture(late);
await fatal(late, lateFixture); eq(await lateRun, "OFF_TARGET_REQUEST_BLOCKED");
eq(lateFixture.observer.first.ORIGINAL_LIFECYCLE_PHASE, "AUTHENTICATION_SUCCEEDED");
eq(late.journal.first.ORIGINAL_LIFECYCLE_PHASE, "AUTHENTICATION_SUCCEEDED");
eq(late.output.includes("P7_CAPTURE_AUTHENTICATION=PASS"), true);
eq(late.clock.count, 0); eq(late.downstream, []);

const early = scenario();
const earlyFixture = requestFixture(early);
await fatal(early, earlyFixture); let credentialCalls = 0;
eq(await early.run(async step => { await step(() => { credentialCalls++; }); }), "OFF_TARGET_REQUEST_BLOCKED");
eq(credentialCalls, 0); eq(early.downstream, []);
eq(earlyFixture.observer.first, null);
eq(early.journal.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION");
eq(early.output.includes("P7_FEEDBACK_REQUEST_OBSERVED=YES"), true);
eq(early.output.includes("P7_AUTH_PHASE_FEEDBACK_REQUEST_OBSERVED=NO"), true);
assert.throws(() => early.boundary.submitStarted()); checks++;
eq(early.boundary.lifecyclePhase, "PRE_AUTHENTICATION");

// A missing window or a seen-but-not-fatal feedback event cannot become a false
// NO_FEEDBACK success. These branches still cannot invoke final verification.
const noWindow = scenario();
eq(await noWindow.run(async () => { submitAndDispatch(noWindow); }), "AUTH_CAPTURE_WINDOW_NOT_STARTED"); eq(noWindow.downstream, []);
const inconsistent = scenario();
const inconsistentRun = inconsistent.run(async () => { submitAndDispatch(inconsistent); inconsistent.boundary.beginObservation(); inconsistent.boundary.observe(requestFixture(inconsistent).request); });
await tick(); inconsistent.clock.advance(30000);
eq(await inconsistentRun, "FEEDBACK_OBSERVED_WITHOUT_FATAL"); eq(inconsistent.downstream, []);
eq(inconsistent.output.includes("P7_AUTHENTICATION_METADATA_CAPTURE=NO_FEEDBACK_AUTH_SUCCESS"), false);

for (const url of [FEEDBACK_RESOURCE, "https://fulfillment-management-platform.vercel.app/login", "https://unknown.invalid/path"]) {
  const test = scenario(); const running = test.run(async step => { await step(() => new Promise(() => {})); });
  await tick(); await fatal(test, requestFixture(test, url));
  eq(await running, "OFF_TARGET_REQUEST_BLOCKED"); eq(test.journal.first.BEFORE_TRANSMISSION, true);
  eq(test.actions.includes("ABORTED"), true); eq(test.downstream, []);
  eq(test.journal.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION");
}
console.log("FEEDBACK_PRODUCTION_UNKNOWN_EXTERNAL_BLOCKED_FATAL=PASS");

const normal = scenario(false);
eq(await normal.run(async step => { submitAndDispatch(normal); normal.boundary.beginObservation(); await step(async () => {}); }), "RETURNED");
eq(normal.downstream, ["SALESPERSON_A_IDENTITY", "/salespeople", "ASSIGNED_CLIENT_BOUNDARY", "/reports", "REPORTS_SESSION", "ISOLATION_CHECKS", "PROTECTION_RECHECK", "BOUNDED_CLOSURE"]);
eq(normal.output, AUTHENTICATION_LIFECYCLE.map(value => `P7_AUTH_LIFECYCLE_PHASE=${value}`));
eq(normal.boundary.lifecyclePhase, "POST_AUTHENTICATION"); eq(normal.boundary.authenticationCollectorActive, false);
eq(normal.clock.count, 0); eq(normal.sealed, 0); eq(normal.boundary.stopped, false);
for (const test of [first, clean, failed, late, early, noWindow, inconsistent]) eq(test.downstream, []);
console.log("CAPTURE_DOWNSTREAM_UNREACHABLE_NORMAL_FINAL_FLOW_PRESERVED=PASS");

// Loading/hydration/field preparation cannot activate collection. A request
// observed then but refused after submit retains PRE_AUTHENTICATION throughout.
const delayed = scenario(); const preauthRequest = requestFixture(delayed);
const blockedOperation = deferred();
const delayedRun = delayed.run(async step => {
  for (const operation of ["PAGE_LOAD", "HYDRATION", "PREFETCH", "CREDENTIAL_PREPARATION", "FIELD_POPULATION"]) {
    await step(() => {
      delayed.actions.push(operation); // Synthetic labels only; no credential/browser operations.
      eq(delayed.boundary.lifecyclePhase, "PRE_AUTHENTICATION");
      eq(delayed.boundary.authenticationCollectorActive, false);
    });
  }
  preauthRequest.observe();
  await step(() => {
    delayed.boundary.submitStarted();
    eq(delayed.boundary.lifecyclePhase, "AUTHENTICATION_SUBMIT_STARTED");
    eq(delayed.boundary.authenticationCollectorActive, true);
    delayed.boundary.requestInFlight();
  });
  await step(() => blockedOperation.promise);
  delayed.actions.push("UNAUTHORIZED_CONTINUATION");
});
await tick();
eq(delayed.boundary.lifecyclePhase, "AUTHENTICATION_REQUEST_IN_FLIGHT");
eq(delayed.boundary.requestPhase(preauthRequest.request), "PRE_AUTHENTICATION");
await fatal(delayed, preauthRequest);
eq(await delayedRun, "OFF_TARGET_REQUEST_BLOCKED");
blockedOperation.resolve(); await tick();
eq(delayed.journal.first.ORIGINAL_LIFECYCLE_PHASE, "PRE_AUTHENTICATION");
eq(preauthRequest.observer.first, null);
eq(delayed.output.includes("P7_AUTH_PHASE_FEEDBACK_REQUEST_OBSERVED=NO"), true);
eq(delayed.actions.includes("UNAUTHORIZED_CONTINUATION"), false);
eq(delayed.downstream, []);

const invalid = scenario();
assert.throws(() => invalid.boundary.requestInFlight(), /AUTH_CAPTURE_LIFECYCLE_TRANSITION_INVALID/); checks++;
eq(invalid.boundary.lifecyclePhase, "PRE_AUTHENTICATION");
invalid.boundary.submitStarted();
assert.throws(() => invalid.boundary.submitStarted(), /AUTH_CAPTURE_LIFECYCLE_TRANSITION_INVALID/); checks++;
eq(invalid.boundary.lifecyclePhase, "AUTHENTICATION_SUBMIT_STARTED");
assert.throws(() => { invalid.boundary.lifecyclePhase = "AUTHENTICATION_SUCCEEDED"; }, TypeError); checks++;
eq(invalid.boundary.requestPhase({}), "UNKNOWN");
eq(await invalid.run(async () => {}), "AUTH_CAPTURE_LIFECYCLE_TRANSITION_INVALID");
eq(invalid.downstream, []);
eq(invalid.output.includes("P7_AUTH_LIFECYCLE_PHASE=AUTHENTICATION_SUCCEEDED"), false);
// Even a completed-looking callback cannot skip submit/dispatch and publish PASS.
const skipped = scenario();
eq(await skipped.run(async () => {}), "AUTH_CAPTURE_LIFECYCLE_TRANSITION_INVALID");
eq(skipped.downstream, []);
eq(skipped.output.includes("P7_CAPTURE_AUTHENTICATION=PASS"), false);
console.log("EXPLICIT_SUBMIT_ONLY_PREAUTH_REQUEST_NEVER_RELABELED=PASS");
console.log("AUTH_SUCCESS_REQUIRES_ORDERED_SUBMIT_DISPATCH_DASHBOARD_FLOW=PASS");

// Static integration and pre-edit hashes tie synthetic dispatch to the real
// runner. Existing request policy, proxy, credential logic and final phase body
// are unchanged (whitespace-insensitive hashes, captured BEFORE this correction).
const read = path => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const source = read("../phase6/hosted-auth-smoke.mjs");
const hash = value => createHash("sha256").update(value).digest("hex");
for (const [start, end, expected] of [
  ["export const PIN", "class Refusal", "97f42e7f52a27e6ca375b2ad958405ffbf883d2cf2e257532b93211466cad01a"],
  ["export function assertEvidence", "// Explicit allowlist", "bd6a206dc5d7c98e812ec8ea3e78937806a75ab6fdf675cd2503dd20665a0ae8"],
  ["export async function createPinnedProxy", "async function credentialFromLauncher", "a2b1daf1fb6a784401204eb40cc44c19f1a8e0afee9dc85391344b35595fd9f9"],
  ["async function credentialFromLauncher", "function assertAppUrl", "d0752d0d6f3abd1440b9b741f7147e7972c8a67ccee573cf4c9f5d8add5e9a15"],
  ['    stage("SALESPERSON_A_IDENTITY");', '    });\n  } catch (error) { if (policyFailure)', "d2fdacd9c4158a37828810606ec34df3671b68c8849e1db74af627d9c4cb839d"],
]) {
  const from = source.indexOf(start); const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from); checks++;
  eq(hash(source.slice(from, to).replace(/^\s+/gm, "")), expected);
}
assert.match(source, /await captureBoundary\.run\(async step => \{[\s\S]*emit\("SALESPERSON_A_AUTHENTICATION"\);\s*\}, async \(\) => \{\s*stage\("SALESPERSON_A_IDENTITY"\)/); checks++;
assert.match(source, /await captureBoundary\.firstFatal\(policyFailure, async \(\) => \{\s*await abortWithFirstRefusal/); checks++;
assert.match(source, /void captureBoundary\.firstFatal\(policyFailure/); checks++;
assert.match(source, /if \(captureBoundary.stopped\) record.password = ""/); checks++;
assert.match(source, /context.on\("request", captureBoundary.observe\)/); checks++;
assert.match(source, /const requestContext = diagnosticContext\(captureBoundary.requestPhase\(request\)\)/); checks++;
assert.match(source, /attachFeedbackMetadata\(page, PIN, before.feedbackProductionRelationship, captureBoundary.requestPhase\)/); checks++;
assert.doesNotMatch(source, /attachFeedbackMetadata\([^\n]*currentStage/); checks++;
// The only live submit transition is adjacent to the intentional click, after
// both field fills, inside the cancellation-checked step callback.
eq(source.match(/captureBoundary\.submitStarted\(\)/g)?.length, 1);
assert.match(source, /await step\(\(\) => page.locator\("input#password"\).fill\(record.password\)\);\s*await step\(async \(\) => \{ await preauthenticationPolicy.settle\(\); demand\(!policyFailure, policyFailure \?\? "NETWORK_POLICY_FAILURE"\); \}\);\s*loginPermit = true;\s*await step\(\(\) => \{[\s\S]*captureBoundary.submitStarted\(\);\s*return submit.click\(\)/); checks++;
eq(source.match(/stage\("SALESPERSON_A_AUTHENTICATION"\)/g)?.length, 1);
eq(source.indexOf('stage("SALESPERSON_A_AUTHENTICATION")') > source.indexOf('page.locator("input#password").fill(record.password)'), true);
// Dispatch phase is set only after the unchanged exact target/OIDC/POST/header
// checks. The reviewed preauth exception is abort-only, never an allowlist.
eq(source.match(/captureBoundary\.requestInFlight\(\)/g)?.length, 1);
assert.match(source, /assertRequest\(currentProof, request.url\(\), request.method\(\)\); assertOidcClaims\(oidc.claims\);[\s\S]*demand\(loginPermit && loginPosts === 0 && !!request.headers\(\)\["next-action"\], "UNAUTHORIZED_POST_BLOCKED"\);[\s\S]*demand\(!headers\["x-vercel-protection-bypass"\] && !headers.authorization, "BROAD_AUTH_HEADER_BLOCKED"\);\s*if \(request.method\(\) === "POST"\) captureBoundary.requestInFlight\(\);\s*beforeTransmission = false;\s*await route.continue/); checks++;
assert.match(source, /await step\(\(\) => authenticate\(step\)\);[\s\S]*transition\("AUTHENTICATION_REQUEST_IN_FLIGHT", "AUTHENTICATION_SUCCEEDED"\);\s*if \(!enabled\) \{\s*transition\("AUTHENTICATION_SUCCEEDED", "POST_AUTHENTICATION"\);\s*return await verifyFinal\(\)/); checks++;
assert.doesNotMatch(source, /NONFATAL_IRRELEVANT_BLOCK/); checks++;
const launcher = read("../../tools/run-phase6-hosted-smoke.ps1");
assert.match(launcher, /\[switch\]\$AuthenticationMetadataCapture/); checks++;
assert.match(launcher, /if \(\$AuthenticationMetadataCapture -and \(\$ConfigOnly -or \$PreflightOnly\)\)/); checks++;
assert.match(launcher, /if \(\$AuthenticationMetadataCapture\) \{ \$arguments \+= ' --authentication-metadata-capture' \}/); checks++;
for (const test of [first, clean, failed, late, early, noWindow, inconsistent, delayed, invalid, skipped]) {
  for (const line of test.output) { assert.match(line, /^P7_[A-Z0-9_]+=[A-Z0-9_]+$/); checks++; }
  eq(test.output.join("\n").includes(secret), false);
}
const evidence = readFileSync(new URL("../../docs/phase7-vercel-automated-access-evidence.json", import.meta.url));
eq(hash(evidence), "eb902d467d76332894051ed2f3807bead33ddcdc0fda3bf1bd7f11d5d81f74cf");
for (const attempt of [JSON.parse(evidence).latestAttempt, JSON.parse(evidence).previousSuccessfulAuthenticationAttempt]) {
  eq(attempt.results.salespersonAAuthentication, "PASS"); eq(attempt.results.dashboardReachedAfterLogin, "PASS");
}
console.log("GUARDS_FINAL_BODY_REDACTION_HISTORICAL_AUTH_EVIDENCE_PRESERVED=PASS");
console.log(`Authentication capture stop-boundary regressions: PASS (${checks} checks; hosted requests: 0; credential reads: 0).`);
