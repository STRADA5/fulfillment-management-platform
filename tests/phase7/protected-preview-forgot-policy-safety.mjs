// Exact-handler regressions; all requests/claims are synthetic. No network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIN, assertRequest, safeCode, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { createCaptureHandler } from "./protected-preview-capture.mjs";
import { passiveForgotMetadata } from "./protected-preview-passive-observer.mjs";
import { forgotCaptureEligibility, waitForBoundedPassiveCapture } from "./protected-preview-forgot-policy.mjs";

localEvidence();
const proof = { ...PIN, checkedAt: Date.now() };
const now = Date.now() / 1000;
const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 };
const sentinel = "SYNTHETIC_PRIVATE_VALUE_NEVER_EMIT";
const exactNames = ["next-router-prefetch", "next-router-segment-prefetch", "next-url", "rsc", "x-deployment-id"];
const clean = { mainFrame: true, pageStillLogin: true, isActive: false, hasBeenActive: false, userGestureSeen: false, anyClickSeen: false, forgotLinkClickSeen: false, focusSeen: false, keyboardSeen: false, pointerSeen: false, formSubmitSeen: false, navigationObserverAvailable: true, routeNavigationSeen: false, programmaticNavigationSeen: false, observationError: false, forgotLinkPresent: true, forgotLinkVisible: true, forgotLinkReactBound: true, forgotLinkPrefetchNotDisabled: true, loginHydrated: true, documentLoading: false };
const evidence = { baseline: { ...clean }, before: { ...clean }, transportComplete: true, sameMainFrame: true, requestCorrelationVerified: true, scriptInitiator: true, approvedScriptInInitiator: true, foreignScriptInInitiator: false, browserHasUserGesture: false };
let checks = 0;
const eq = (actual, expected) => { assert.deepEqual(actual, expected); checks++; };

function fixture(overrides = {}, options = {}, targetProof = proof, targetClaims = claims, observation = evidence) {
  const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0, irrelevantBlockCount: 0, rscNonfatalBlockCount: 0, forgotNonfatalBlockCount: 0, loginNavigationSeen: true, loginResponseObserved: true, hydrationCompleted: false, emptyFormConstruction: false };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const counts = { abort: 0, forward: 0, headerAttachments: 0, bodies: 0, observer: 0 };
  const captures = []; const nonfatal = [];
  const request = {
    url: () => `${PIN.url}/forgot-password?_rsc=${sentinel}`, method: () => "GET", resourceType: () => "fetch",
    headersArray: async () => exactNames.map((name) => ({ name, value: sentinel })),
    headers: () => { counts.headerAttachments++; throw Error("HEADER_ATTACHMENT_PROHIBITED"); },
    postDataBuffer: () => { counts.bodies++; return null; },
    isNavigationRequest: () => false, redirectedFrom: () => null, serviceWorker: () => null, frame: () => frame, ...overrides,
  };
  const route = { request: () => request, abort: async () => { counts.abort++; }, continue: async () => { counts.forward++; } };
  const passiveForgotObserver = { forRequest: async () => { counts.observer++; assert.ok(counts.abort > 0); checks++; return observation; } };
  const policy = { mode: "CAPTURE_ONLY", rscCaptureOnce: true, rscMetadataOnly: false, forgotCaptureOnce: true, forgotMetadataOnly: false, freshIsolatedContext: true, productionExcluded: true, page, passiveForgotObserver, onForgotIrrelevant: (record) => nonfatal.push(record), ...options };
  const handler = createCaptureHandler(targetProof, { token: sentinel, claims: targetClaims }, state, (record) => captures.push(record), new Map(), policy);
  const metadataFacts = { headerNames: exactNames, headersKnown: true, navigation: false, redirected: false, initiatingPage: `${PIN.url}/login`, frame, framePage: page, page, freshIsolatedContext: true, passiveOnly: true, loginResponseObserved: true };
  return { request, route, state, counts, captures, nonfatal, handler, policy, page, metadataFacts };
}

const first = fixture();
await first.handler(first.route);
eq(first.state.stopped, false); eq(first.state.firstRefusal, null);
eq(first.state.forgotNonfatalBlockCount, 1); eq(first.captures.length, 0); eq(first.nonfatal.length, 1);
eq(first.nonfatal[0].networkDecision, "BLOCKED"); eq(first.nonfatal[0].captureControl, "NONFATAL_IRRELEVANT_BLOCK");
eq(first.nonfatal[0].singleOccurrenceOnly, true); eq(first.nonfatal[0].forgotPasswordAbortConfirmed, true);
eq(first.nonfatal[0].guardResult, "OUT_OF_SCOPE_PATH_BLOCKED");
eq(first.nonfatal[0].forgotPasswordMetadata.purposeClassification, "AUTOMATIC_FRAMEWORK_PREFETCH");
eq(first.nonfatal[0].authenticationRelevant, false);
eq(first.counts.abort, 1); eq(first.counts.forward, 0); eq(first.counts.headerAttachments, 0); eq(first.counts.bodies, 1);
eq(JSON.stringify(first.nonfatal).includes(sentinel), false);
assert.throws(() => assertRequest(proof, first.request.url()), (error) => safeCode(error) === "OUT_OF_SCOPE_PATH_BLOCKED"); checks++;
console.log("FIRST_FORGOT_PREFETCH_BLOCKED_NONFATAL=PASS");
first.request.url = () => `${PIN.url}/forgot-password?_rsc=SECOND_SYNTHETIC`;
await first.handler(first.route);
eq(first.state.stopped, true); eq(first.state.forgotNonfatalBlockCount, 1);
eq(first.captures.length, 1); eq(first.nonfatal.length, 1);
eq(first.captures[0].captureControl, "FATAL"); eq(first.captures[0].forgotPredicates.FIRST_FORGOT_ONLY, false);
eq(first.counts.abort, 2); eq(first.counts.forward, 0);
console.log("REPEATED_FORGOT_PREFETCH_FATAL=PASS");

async function fatal(overrides = {}, options = {}, targetProof = proof, targetClaims = claims, observed = evidence) {
  const test = fixture(overrides, options, targetProof, targetClaims, observed);
  await test.handler(test.route);
  eq(test.state.stopped, true); eq(test.state.forgotNonfatalBlockCount, 0);
  eq(test.counts.abort, 1); eq(test.counts.forward, 0); eq(test.counts.headerAttachments, 0);
  eq(test.captures.length, 1); eq(test.nonfatal.length, 0);
  eq(test.captures[0].captureControl.startsWith("FATAL"), true);
  eq(JSON.stringify(test.captures).includes(sentinel), false);
  return test;
}
await fatal({ resourceType: () => "document", isNavigationRequest: () => true });
await fatal({ isNavigationRequest: () => true });
await fatal({ url: () => `${PIN.url}/forgot-password`, resourceType: () => "document", isNavigationRequest: () => true });
console.log("REAL_FORGOT_NAVIGATION_FATAL=PASS");
for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) await fatal({ method: () => method });
await fatal({ method: () => "POST", resourceType: () => "document", isNavigationRequest: () => true });
await fatal({ headersArray: async () => [...exactNames, "next-action"].map((name) => ({ name, value: sentinel })) });
console.log("FORGOT_POST_FORM_SERVER_ACTION_FATAL=PASS");
for (const name of ["authorization", "cookie", "x-api-key", "x-vercel-trusted-oidc-idp-token", "x-vercel-protection-bypass", "unknown-header", "content-length", "next-router-state-tree"]) {
  await fatal({ headersArray: async () => [...exactNames, name].map((key) => ({ name: key, value: sentinel })) });
}
console.log("CREDENTIAL_BEARING_FORGOT_FATAL=PASS");
await fatal({ headersArray: async () => [] });
await fatal({ resourceType: () => "xhr" });
await fatal({ url: () => `${PIN.url}/other`, headersArray: async () => [] });
console.log("ORDINARY_FETCH_XHR_FATAL=PASS");
for (const url of [`${PIN.url}/api/auth/session`, `${PIN.url}/login`, "https://nftufhffzlokryafcbku.supabase.co/auth/v1/token"]) await fatal({ url: () => url });
const auth = await fatal({ url: () => `${PIN.url}/login`, method: () => "POST", headersArray: async () => [{ name: "next-action", value: sentinel }] });
eq(auth.counts.bodies, 0); eq(auth.captures[0].authenticationRelevant, true);
eq(auth.captures[0].guardResult, "PASS"); eq(auth.captures[0].captureAbortReason, "CAPTURE_ONLY_MUTATION_ABORT");
console.log("AUTH_SUPABASE_SERVER_ACTION_FATAL=PASS");
await fatal({ url: () => "https://fulfillment-management-platform-q39nhsf03.vercel.app/forgot-password?_rsc=x" });
await fatal({ url: () => "https://unknown.invalid/forgot-password?_rsc=x" });
await fatal({}, {}, { ...proof, deploymentId: "dpl_other" });
console.log("OTHER_DEPLOYMENT_ORIGIN_FATAL=PASS");
await fatal({ url: () => "https://production.invalid/forgot-password?_rsc=x" });
await fatal({}, { productionExcluded: false });
console.log("PRODUCTION_FATAL=PASS");

for (const name of exactNames) await fatal({ headersArray: async () => exactNames.filter((key) => key !== name).map((key) => ({ name: key, value: sentinel })) });
await fatal({ headersArray: async () => { throw Error(sentinel); } });
await fatal({ postDataBuffer: () => new Proxy({}, { get() { throw Error("BODY_BYTES_READ"); } }) });
await fatal({ postDataBuffer: () => { throw Error(sentinel); } });
await fatal({ serviceWorker: () => ({}) });
await fatal({ serviceWorker: () => { throw Error(sentinel); } });
for (const url of [`${PIN.url}/another`, "https://production.invalid/"]) await fatal({ redirectedFrom: () => ({ url: () => url, redirectedFrom: () => null }) });
for (const url of [`${PIN.url}/forgot-password`, `${PIN.url}/forgot-password?_rsc=x&_rsc=y`, `${PIN.url}/forgot-password?_rsc=x&token=x`, `${PIN.url}/forgot-password?_rsc=x#fragment`, `${PIN.url}:444/forgot-password?_rsc=x`, PIN.url.replace("https:", "http:") + "/forgot-password?_rsc=x", PIN.url.replace("https://", "https://user@") + "/forgot-password?_rsc=x"]) await fatal({ url: () => url });
for (const options of [{ mode: "RELEASE" }, { forgotCaptureOnce: false }, { forgotCaptureOnce: undefined }, { forgotMetadataOnly: true }, { forgotMetadataOnly: undefined }, { freshIsolatedContext: false }, { passiveForgotObserver: null }]) await fatal({}, options);
await fatal({}, {}, proof, { ...claims, exp: now - 1 });
for (const phase of ["baseline", "before"]) for (const key of ["isActive", "hasBeenActive", "userGestureSeen", "anyClickSeen", "focusSeen", "keyboardSeen", "pointerSeen", "formSubmitSeen", "programmaticNavigationSeen"]) {
  await fatal({}, {}, proof, claims, { ...evidence, [phase]: { ...clean, [key]: true } });
}
await fatal({}, {}, proof, claims, { ...evidence, transportComplete: false });
await fatal({}, {}, proof, claims, { ...evidence, requestCorrelationVerified: false });

// Exact predicates, including all passive observations, cannot be absent/flipped.
const synthetic = fixture();
const metadata = passiveForgotMetadata(proof, synthetic.request, synthetic.metadataFacts, evidence);
const facts = { metadata, mode: "CAPTURE_ONLY", enabled: true, metadataOnly: false, stopped: false, firstRefusal: null, occurrenceCount: 0, abortConfirmed: true, originalDecision: "OUT_OF_SCOPE_PATH_BLOCKED", url: synthetic.request.url(), method: "GET", resourceType: "fetch", initiatingPage: `${PIN.url}/login`, applicationPage: `${PIN.url}/login`, freshIsolatedContext: true, productionExcluded: true };
eq(forgotCaptureEligibility(proof, claims, facts).eligible, true);
for (const [key, value] of Object.entries(metadata)) {
  // This deliberately unknown DOM-causality field was not part of the proof.
  if (key === "initiatingElementIsForgotPasswordLink") continue;
  const missing = { ...metadata }; delete missing[key];
  eq(forgotCaptureEligibility(proof, claims, { ...facts, metadata: missing }).eligible, false);
  if (typeof value === "boolean") eq(forgotCaptureEligibility(proof, claims, { ...facts, metadata: { ...metadata, [key]: !value } }).eligible, false);
  if (value && typeof value === "object" && !Array.isArray(value)) for (const [inner, flag] of Object.entries(value)) {
    const changed = { ...value }; delete changed[inner];
    eq(forgotCaptureEligibility(proof, claims, { ...facts, metadata: { ...metadata, [key]: changed } }).eligible, false);
    eq(forgotCaptureEligibility(proof, claims, { ...facts, metadata: { ...metadata, [key]: { ...value, [inner]: !flag } } }).eligible, false);
  }
}
for (const key of Object.keys(facts)) {
  const missing = { ...facts }; delete missing[key];
  eq(forgotCaptureEligibility(proof, claims, missing).eligible, false);
}
for (const key of Object.keys(PIN)) eq(forgotCaptureEligibility({ ...proof, [key]: "wrong" }, claims, facts).eligible, false);
eq(forgotCaptureEligibility({ ...proof, checkedAt: Date.now() - 600001 }, claims, facts).eligible, false);
const abortFailure = fixture();
abortFailure.route.abort = async () => { abortFailure.counts.abort++; throw Error(sentinel); };
await abortFailure.handler(abortFailure.route);
eq(abortFailure.state.stopped, true); eq(abortFailure.state.forgotNonfatalBlockCount, 0);
eq(abortFailure.nonfatal.length, 0); eq(abortFailure.counts.forward, 0); eq(abortFailure.counts.observer, 0);
eq(abortFailure.captures[0].captureAbortReason, "FORGOT_ABORT_NOT_CONFIRMED");
const concurrent = fixture();
await Promise.all([concurrent.handler(concurrent.route), concurrent.handler(concurrent.route)]);
eq(concurrent.nonfatal.length, 1); eq(concurrent.captures.length, 1); eq(concurrent.state.forgotNonfatalBlockCount, 1);
eq(concurrent.state.stopped, true); eq(concurrent.counts.forward, 0);

eq(await waitForBoundedPassiveCapture({ stopped: true }, new Promise(() => {}), 1), "FATAL_REQUEST_CAPTURED");
eq(await waitForBoundedPassiveCapture({ stopped: false }, Promise.resolve(), 100), "CAPTURE_STOPPED");
eq(await waitForBoundedPassiveCapture({ stopped: false }, new Promise(() => {}), 1), "NO_FURTHER_REQUEST_OBSERVED");
const runner = readFileSync(new URL("./protected-preview-capture.mjs", import.meta.url), "utf8");
assert.match(runner, /if \(forgotCaptureOnce\) \{\s+emit\("BOUNDED_CAPTURE_OUTCOME", await waitForBoundedPassiveCapture\(state, stopped\)\);\s+return;/); checks++;
assert.ok(runner.indexOf('emit("BOUNDED_CAPTURE_OUTCOME"') < runner.indexOf("await page.evaluate(loginHydrationReady)")); checks++;
const policy = readFileSync(new URL("./protected-preview-forgot-policy.mjs", import.meta.url), "utf8");
assert.doesNotMatch(policy, /route\.continue|headersArray|\.postData|CredRead|credentialFromLauncher|storageState/); checks++;
console.log(`Exact forgot-password capture policy: PASS (${checks} checks; hosted requests: 0; network forwards: 0).`);
