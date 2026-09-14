// Actual runner policy tests, synthetic inputs only. No browser, CLI or network access.
import assert from "node:assert/strict";
import { PIN, assertRequest, safeCode, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { TOOLBAR_URL, toolbarEligibility, scriptCredentialsAbsent, productionExcludesToolbar, createCaptureHandler } from "./protected-preview-capture.mjs";
localEvidence();
const proof = { ...PIN, checkedAt: Date.now() };
const now = Date.now() / 1000;
const oidc = { token: "SYNTHETIC_NOT_A_TOKEN", claims: { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 } };
const base = { mode: "CAPTURE_ONLY", stopped: false, url: TOOLBAR_URL, method: "GET", resourceType: "script", applicationPage: `${PIN.url}/login`, frameUrl: `${PIN.url}/login`, mainFrame: true, navigation: false, redirected: false, serviceWorker: false, formSubmission: false, serverAction: false, bodyAbsent: true, credentialsAbsent: true, productionExcluded: true, irrelevantBlockCount: 0 };
let checks = 0;
assert.equal(toolbarEligibility(proof, base).eligible, true); checks++;
for (const key of Object.keys(base)) {
  const missing = { ...base }; delete missing[key];
  assert.equal(toolbarEligibility(proof, missing).eligible, false); checks++;
}
for (const [key, value] of [["mode", "RELEASE"], ["stopped", true], ["method", "POST"], ["method", "HEAD"], ["resourceType", "fetch"], ["resourceType", "xhr"], ["resourceType", "document"], ["navigation", true], ["redirected", true], ["serviceWorker", true], ["formSubmission", true], ["serverAction", true], ["bodyAbsent", false], ["credentialsAbsent", false], ["productionExcluded", false], ["mainFrame", false], ["irrelevantBlockCount", 1], ["frameUrl", "https://unknown.invalid"], ["applicationPage", `${PIN.url}/reports`]]) {
  assert.equal(toolbarEligibility(proof, { ...base, [key]: value }).eligible, false); checks++;
}
for (const key of Object.keys(PIN)) { assert.equal(toolbarEligibility({ ...proof, [key]: "wrong" }, base).eligible, false); checks++; }
assert.equal(toolbarEligibility({ ...proof, checkedAt: Date.now() - 600001 }, base).eligible, false); checks++;
for (const url of [TOOLBAR_URL + ".other", TOOLBAR_URL + "?x=synthetic", TOOLBAR_URL + "#synthetic", TOOLBAR_URL.replace("https:", "http:"), TOOLBAR_URL.replace("vercel.live", "vercel.live.evil.invalid"), TOOLBAR_URL.replace("vercel.live", "vercel.live:444"), TOOLBAR_URL.replace("https://", "https://userinfo@"), "https://vercel.live/other.js"]) {
  assert.equal(toolbarEligibility(proof, { ...base, url }).eligible, false); checks++;
}
const productionProject = { id: PIN.projectId, name: PIN.project, accountId: PIN.teamId, targets: { production: { url: "production.invalid", alias: ["production-alias.invalid"] } } };
assert.equal(productionExcludesToolbar(productionProject), true); checks++;
for (const project of [{ ...productionProject, id: "wrong" }, { ...productionProject, targets: undefined }, { ...productionProject, targets: { production: {} } }, { ...productionProject, targets: { production: { url: "vercel.live", alias: [] } } }, { ...productionProject, targets: { production: { url: "production.invalid", alias: ["vercel.live"] } } }]) {
  assert.equal(productionExcludesToolbar(project), false); checks++;
}
assert.equal(scriptCredentialsAbsent([{ name: "referer", value: `${PIN.url}/` }, { name: "accept", value: "*/*" }]), true); checks++;
for (const name of ["authorization", "cookie", "x-api-key", "apikey", "x-vercel-trusted-oidc-idp-token", "x-vercel-protection-bypass", "unknown-custom-header", "content-length", "transfer-encoding"]) {
  assert.equal(scriptCredentialsAbsent([{ name, value: "DO_NOT_LOG_TEST_VALUE" }]), false); checks++;
}
assert.equal(scriptCredentialsAbsent([{ name: "referer", value: `${PIN.url}/login?secret=synthetic` }]), false); checks++;
assert.equal(scriptCredentialsAbsent(undefined), false); checks++;

function fixture(overrides = {}, options = {}) {
  const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0, irrelevantBlockCount: 0, loginNavigationSeen: false, hydrationCompleted: true, emptyFormConstruction: true };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const capture = []; const irrelevant = [];
  const observations = { aborted: 0, continued: 0, bodyPresenceChecks: 0 };
  const request = { url: () => TOOLBAR_URL, method: () => "GET", resourceType: () => "script", headers: () => ({}), headersArray: async () => [{ name: "referer", value: `${PIN.url}/` }], frame: () => frame, isNavigationRequest: () => false, redirectedFrom: () => null, serviceWorker: () => null, postDataBuffer: () => { observations.bodyPresenceChecks++; return null; }, ...overrides };
  const route = { request: () => request, abort: async () => { observations.aborted++; }, continue: async () => { observations.continued++; } };
  const handler = createCaptureHandler(proof, oidc, state, (record) => capture.push(record), new Map(), { mode: "CAPTURE_ONLY", page, productionExcluded: true, onIrrelevant: (record) => irrelevant.push(record), ...options });
  return { state, capture, irrelevant, observations, request, route, handler };
}
const known = fixture();
await known.handler(known.route);
assert.equal(known.observations.aborted, 1);
assert.equal(known.observations.continued, 0);
assert.equal(known.state.stopped, false);
assert.equal(known.irrelevant[0].captureControl, "NONFATAL_IRRELEVANT_BLOCK");
assert.equal(known.irrelevant[0].guardResult, "OFF_TARGET_REQUEST_BLOCKED");
assert.equal(known.capture.length, 0);
assert.throws(() => assertRequest(proof, TOOLBAR_URL), (error) => safeCode(error) === "OFF_TARGET_REQUEST_BLOCKED");
checks += 7;
console.log("KNOWN_TOOLBAR_BLOCK_NONFATAL=PASS");
await known.handler(known.route);
assert.equal(known.state.stopped, true);
assert.equal(known.irrelevant.length, 1);
assert.equal(known.capture.length, 1);
assert.equal(known.observations.continued, 0);
checks += 4;
console.log("REPEATED_TOOLBAR_FATAL=PASS");

async function expectFatal(overrides, options) {
  const test = fixture(overrides, options);
  await test.handler(test.route);
  assert.equal(test.observations.continued, 0);
  assert.equal(test.observations.aborted, 1);
  assert.equal(test.state.stopped, true);
  assert.equal(test.irrelevant.length, 0);
  assert.equal(test.capture.length, 1);
  checks++; return test;
}
await expectFatal({ url: () => "https://vercel.live/other.js" });
await expectFatal({ url: () => "https://unknown.invalid/feedback.js" });
console.log("DIFFERENT_EXTERNAL_SCRIPT_FATAL=PASS");
for (const method of ["POST", "PUT", "DELETE"]) for (const resourceType of ["fetch", "xhr", "script", "document"]) {
  const test = await expectFatal({ method: () => method, resourceType: () => resourceType });
  assert.equal(test.observations.bodyPresenceChecks, 0); checks++;
}
for (const resourceType of ["fetch", "xhr"]) await expectFatal({ resourceType: () => resourceType });
console.log("UNAPPROVED_POST_FETCH_XHR_FATAL=PASS");
await expectFatal({ url: () => "https://production.invalid/login" });
await expectFatal({}, { productionExcluded: false });
console.log("PRODUCTION_DESTINATION_FATAL=PASS");
await expectFatal({ url: () => "https://unknown.invalid/login", resourceType: () => "document", isNavigationRequest: () => true });
console.log("UNKNOWN_NAVIGATION_FATAL=PASS");
await expectFatal({ headersArray: async () => { throw Error("DO_NOT_LOG_TEST_VALUE"); } });
await expectFatal({ serviceWorker: () => { throw Error("unavailable"); } });
await expectFatal({ headersArray: async () => [{ name: "cookie", value: "DO_NOT_LOG_TEST_VALUE" }] });
const opaqueBody = new Proxy({}, { get() { throw Error("BODY_CONTENTS_MUST_NEVER_BE_READ"); } });
const hasBody = await expectFatal({ postDataBuffer: () => opaqueBody });
assert.equal(JSON.stringify(hasBody.capture).includes("BODY_CONTENTS"), false); checks++;
for (const resourceType of ["fetch", "xhr"]) {
  const auth = await expectFatal({ url: () => `${PIN.url}/login`, resourceType: () => resourceType, headers: () => ({ "next-router-prefetch": "1" }), headersArray: async () => [{ name: "next-router-prefetch", value: "1" }] });
  assert.equal(auth.capture[0].authenticationRelevant, true); checks++;
}
const asset = fixture({ url: () => `${PIN.url}/_next/static/chunks/test.js` });
await asset.handler(asset.route);
assert.equal(asset.observations.continued, 1); checks++;
const authPost = await expectFatal({ url: () => `${PIN.url}/login`, method: () => "POST", resourceType: () => "fetch", headersArray: async () => [{ name: "next-action", value: "DO_NOT_LOG_TEST_VALUE" }] });
assert.equal(authPost.capture[0].guardResult, "PASS");
assert.equal(authPost.capture[0].hydratedAuthRequestCaptured, true);
assert.equal(JSON.stringify(authPost.capture).includes("DO_NOT_LOG_TEST_VALUE"), false);
checks += 3;
console.log("APPROVED_PREVIEW_TARGET_RULES_PRESERVED=PASS");
console.log(`CAPTURE_POLICY_CHECKS=${checks}`);
console.log("POLICY_TEST_NETWORK_OPERATIONS=0");
