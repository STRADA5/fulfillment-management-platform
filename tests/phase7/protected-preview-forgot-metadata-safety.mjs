// Offline only: synthetic request objects/DOM, no browser or provider access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { PIN, assertRequest, safeCode, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { createCaptureHandler } from "./protected-preview-capture.mjs";
import { isExactForgotRequest, forgotRequestMetadata, sanitizeForgotObservation, installForgotMetadataObserver, waitForForgotMetadataStop } from "./protected-preview-forgot-metadata.mjs";

localEvidence();
const proof = { ...PIN, checkedAt: Date.now() };
const now = Date.now() / 1000;
const oidc = { token: "SYNTHETIC_ONLY", claims: { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 } };
const sentinel = "SYNTHETIC_SECRET_NEVER_EMIT";
const names = ["rsc", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "x-deployment-id"];
const observation = { observerReady: true, mainFrame: true, pageStillLogin: true, userGestureSeen: false, userActivationSeen: false, anyClickSeen: false, forgotLinkClickSeen: false, formSubmitSeen: false, navigationObserverAvailable: true, routeNavigationSeen: false, programmaticNavigationSeen: false, observationError: false, forgotLinkPresent: true, forgotLinkVisible: true, forgotLinkReactBound: true, forgotLinkPrefetchNotDisabled: true, loginHydrated: true, documentLoading: false };
let checks = 0;
function fixture(overrides = {}, factOverrides = {}) {
  const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0, hydrationCompleted: false, emptyFormConstruction: false, irrelevantBlockCount: 0, rscNonfatalBlockCount: 0 };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const counts = { abort: 0, forward: 0, bodies: 0, headerAttachments: 0 };
  const request = {
    url: () => `${PIN.url}/forgot-password?_rsc=${sentinel}`, method: () => "GET", resourceType: () => "fetch",
    headersArray: async () => names.map((name) => ({ name, value: sentinel })),
    headers: () => { counts.headerAttachments++; throw Error("NO_HEADERS_ALLOWED"); },
    postDataBuffer: () => { counts.bodies++; return null; },
    isNavigationRequest: () => false, redirectedFrom: () => null, frame: () => frame, serviceWorker: () => null,
    ...overrides,
  };
  const facts = { headerNames: names, headersKnown: true, navigation: false, redirected: false, frame, framePage: page, page, initiatingPage: `${PIN.url}/login`, freshIsolatedContext: true, passiveOnly: true, observation, observationFrameMatches: true, ...factOverrides };
  const captured = [];
  const route = { request: () => request, abort: async () => { counts.abort++; }, continue: async () => { counts.forward++; } };
  const handler = createCaptureHandler(proof, oidc, state, (record) => captured.push(record), new Map(), { mode: "CAPTURE_ONLY", page, productionExcluded: true, freshIsolatedContext: true, rscCaptureOnce: true, rscMetadataOnly: false, forgotMetadataOnly: true, forgotObservation: () => ({ frame, metadata: observation }) });
  return { state, frame, page, counts, request, route, facts, captured, handler };
}
const exact = fixture();
await exact.handler(exact.route);
const record = exact.captured[0];
assert.equal(record.captureControl, "FATAL_OR_AUTH_CAPTURE_STOP");
assert.equal(record.captureAbortReason, "OUT_OF_SCOPE_PATH_BLOCKED");
assert.equal(record.forgotPasswordAbortConfirmed, true);
assert.equal(record.forgotPasswordMetadata.purposeClassification, "AUTOMATIC_NEXTJS_PREFETCH");
assert.equal(record.forgotPasswordMetadata.initiatingElementIsForgotPasswordLink, null);
assert.equal(record.forgotPasswordMetadata.routerStateMarkerPresent, false);
assert.equal(record.forgotPasswordMetadata.routerSegmentMarkerPresent, true);
assert.equal(exact.state.stopped, true);
assert.equal(exact.state.rscNonfatalBlockCount, 0);
assert.equal(exact.counts.abort, 1);
assert.equal(exact.counts.forward, 0);
assert.equal(exact.counts.headerAttachments, 0);
assert.equal(exact.counts.bodies, 1);
assert.equal(JSON.stringify(record).includes(sentinel), false);
assert.throws(() => assertRequest(proof, exact.request.url()), (error) => safeCode(error) === "OUT_OF_SCOPE_PATH_BLOCKED");
checks += 15;
await exact.handler(exact.route);
assert.equal(exact.counts.abort, 2);
assert.equal(exact.counts.bodies, 1);
assert.equal(exact.captured.length, 1);
checks += 3;

for (const extra of ["authorization", "cookie", "x-api-key", "x-vercel-trusted-oidc-idp-token", "x-vercel-protection-bypass", "unknown-header", "next-action"]) {
  const test = fixture({ headersArray: async () => [...names, extra].map((name) => ({ name, value: sentinel })) }, { headerNames: [...names, extra] });
  const metadata = forgotRequestMetadata(proof, test.request, test.facts);
  assert.equal(metadata.purposeClassification, "UNKNOWN");
  assert.equal(JSON.stringify(metadata).includes(sentinel), false);
  await test.handler(test.route);
  assert.equal(test.state.stopped, true);
  assert.equal(test.counts.forward, 0);
  checks += 4;
}
for (const key of Object.keys(observation)) {
  const test = fixture({}, { observation: { ...observation, [key]: undefined } });
  assert.equal(forgotRequestMetadata(proof, test.request, test.facts).purposeClassification, "UNKNOWN"); checks++;
}
for (const key of ["userGestureSeen", "userActivationSeen", "anyClickSeen", "forgotLinkClickSeen", "formSubmitSeen", "routeNavigationSeen", "programmaticNavigationSeen", "observationError"]) {
  const test = fixture({}, { observation: { ...observation, [key]: true } });
  assert.equal(forgotRequestMetadata(proof, test.request, test.facts).purposeClassification, "UNKNOWN"); checks++;
}
for (const changedFacts of [{ headersKnown: false }, { headerNames: [] }, { navigation: true }, { navigation: undefined }, { redirected: true }, { frame: null }, { observationFrameMatches: false }, { passiveOnly: false }, { freshIsolatedContext: false }]) {
  const test = fixture({}, changedFacts);
  assert.equal(forgotRequestMetadata(proof, test.request, test.facts).purposeClassification, "UNKNOWN"); checks++;
}
const body = fixture({ postDataBuffer: () => new Proxy({}, { get() { throw Error("BODY_BYTES_ACCESSED"); } }) });
assert.equal(forgotRequestMetadata(proof, body.request, body.facts).requestBodyPresent, true);
assert.equal(forgotRequestMetadata(proof, body.request, body.facts).purposeClassification, "UNKNOWN");
const unknownBody = fixture({ postDataBuffer: () => { throw Error(sentinel); } });
assert.equal(forgotRequestMetadata(proof, unknownBody.request, unknownBody.facts).requestBodyPresent, null);
checks += 3;
for (const [url, method, resourceType] of [
  [`${PIN.url}/forgot-password`, "GET", "fetch"], [`${PIN.url}/forgot-password?_rsc=x`, "POST", "fetch"],
  [`${PIN.url}/forgot-password?_rsc=x`, "GET", "document"], [`${PIN.url}/forgot-password?_rsc=x`, "GET", "xhr"],
  [`${PIN.url}/forgot-password?_rsc=x&_rsc=y`, "GET", "fetch"], [`${PIN.url}/forgot-password?_rsc=x&token=x`, "GET", "fetch"],
  [`${PIN.url}/login`, "POST", "fetch"], [`${PIN.url}/api/auth/session`, "GET", "fetch"],
  ["https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", "POST", "fetch"],
  ["https://production.invalid/forgot-password?_rsc=x", "GET", "fetch"],
  ["https://fulfillment-management-platform-q39nhsf03.vercel.app/forgot-password?_rsc=x", "GET", "fetch"],
]) {
  const test = fixture({ url: () => url, method: () => method, resourceType: () => resourceType });
  assert.equal(isExactForgotRequest(proof, url, method, resourceType), false);
  assert.equal(forgotRequestMetadata(proof, test.request, test.facts), null);
  assert.equal(test.counts.bodies, 0);
  await test.handler(test.route);
  assert.equal(test.counts.forward, 0);
  assert.equal(test.state.stopped, true);
  checks += 5;
}
const failedAbort = fixture();
failedAbort.route.abort = async () => { throw Error(sentinel); };
await failedAbort.handler(failedAbort.route);
assert.equal(failedAbort.captured[0].forgotPasswordAbortConfirmed, false);
assert.equal(failedAbort.captured[0].captureAbortReason, "FORGOT_ABORT_NOT_CONFIRMED");
assert.equal(failedAbort.state.stopped, true);
assert.equal(failedAbort.counts.forward, 0);
checks += 4;

// Exercise the actual passive browser observer in a synthetic VM, not a browser.
const listeners = new Map(); const snapshots = []; let fakeFetches = 0;
class FakeAnchor {}
const link = Object.assign(new FakeAnchor(), { href: `${PIN.url}/forgot-password`, __reactProps$test: { href: "/forgot-password", onClick() {} }, getBoundingClientRect: () => ({ width: 40, height: 20 }) });
const form = { __reactProps$test: { action() {} }, __reactFiber$test: { tag: 3, stateNode: { current: { memoizedState: { isDehydrated: false } } } } };
const email = { form, get value() { throw Error("FIELD_VALUE_READ"); } };
const sandbox = { URL, Request, HTMLAnchorElement: FakeAnchor, location: { href: `${PIN.url}/login` }, navigator: { userActivation: { hasBeenActive: false } },
  getComputedStyle: () => ({ visibility: "visible", display: "block" }),
  document: { baseURI: `${PIN.url}/login`, readyState: "complete", querySelectorAll: () => [link], querySelector: () => email },
  addEventListener: (type, callback) => listeners.set(type, callback),
  navigation: { addEventListener: (_type, callback) => listeners.set("navigate", callback) },
  fetch: async () => { fakeFetches++; return {}; }, __p7ForgotMetadata: async (metadata) => snapshots.push(sanitizeForgotObservation(metadata)),
};
sandbox.window = sandbox; sandbox.top = sandbox;
runInNewContext(`(${installForgotMetadataObserver.toString()})(${JSON.stringify({ origin: PIN.url })})`, sandbox);
await sandbox.fetch(`${PIN.url}/forgot-password?_rsc=SYNTHETIC`);
assert.equal(fakeFetches, 1);
assert.deepEqual(snapshots[0], observation);
assert.equal(Object.values(snapshots[0]).every((value) => typeof value === "boolean"), true);
listeners.get("click")({ isTrusted: true, composedPath: () => [link] });
listeners.get("navigate")({ destination: { url: `${PIN.url}/forgot-password` }, userInitiated: false, formData: null });
await sandbox.fetch(`${PIN.url}/forgot-password?_rsc=SYNTHETIC`);
assert.equal(snapshots[1].forgotLinkClickSeen, true);
assert.equal(snapshots[1].userGestureSeen, true);
assert.equal(snapshots[1].programmaticNavigationSeen, true);
await sandbox.fetch(`${PIN.url}/another-path`);
assert.equal(snapshots.length, 2);
checks += 7;

await waitForForgotMetadataStop({ stopped: true }, new Promise(() => {}), 1);
await waitForForgotMetadataStop({ stopped: false }, Promise.resolve(), 10);
await assert.rejects(waitForForgotMetadataStop({ stopped: false }, new Promise(() => {}), 1), /FORGOT_METADATA_REQUEST_NOT_OBSERVED/);
checks += 3;
const source = readFileSync(new URL("./protected-preview-capture.mjs", import.meta.url), "utf8");
assert.match(source, /await waitForForgotMetadataStop\(state, stopped\);\s+return;/);
assert.ok(source.indexOf("await waitForForgotMetadataStop(state, stopped)") < source.indexOf("form.requestSubmit()"));
assert.equal(JSON.stringify(sanitizeForgotObservation({ password: sentinel, observerReady: sentinel })).includes(sentinel), false);
checks += 3;
console.log(`Forgot-password metadata-only safety: PASS (${checks} checks; network forwards: 0; hosted captures: 0).`);
