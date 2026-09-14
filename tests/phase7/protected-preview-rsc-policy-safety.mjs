// Actual capture-handler regression tests. Synthetic metadata only; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIN, assertRequest, safeCode, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { rootRscMetadata } from "./protected-preview-rsc-metadata.mjs";
import { rootRscCaptureEligibility } from "./protected-preview-rsc-policy.mjs";
import { createCaptureHandler } from "./protected-preview-capture.mjs";

localEvidence();
const proof = { ...PIN, checkedAt: Date.now() };
const now = Date.now() / 1000;
const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 };
const sentinel = "SYNTHETIC_PRIVATE_VALUE_MUST_NOT_BE_EMITTED";
const exactNames = ["next-router-prefetch", "next-router-segment-prefetch", "next-url", "rsc", "x-deployment-id"];
let checks = 0;
function fixture(overrides = {}, policyOverrides = {}, targetProof = proof, targetClaims = claims) {
  const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0, irrelevantBlockCount: 0, rscNonfatalBlockCount: 0, loginNavigationSeen: false, hydrationCompleted: false, emptyFormConstruction: false };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const counts = { abort: 0, forward: 0, headerAttachments: 0, bodies: 0 };
  const captures = []; const nonfatal = [];
  const request = {
    url: () => `${PIN.url}/?_rsc=${sentinel}`, method: () => "GET", resourceType: () => "fetch",
    headersArray: async () => exactNames.map((name) => ({ name, value: sentinel })),
    headers: () => { counts.headerAttachments++; throw Error("NO_HEADER_ATTACHMENT_ALLOWED"); },
    postDataBuffer: () => { counts.bodies++; return null; },
    isNavigationRequest: () => false, redirectedFrom: () => null, serviceWorker: () => null, frame: () => frame,
    ...overrides,
  };
  const route = { request: () => request, abort: async () => { counts.abort++; }, continue: async () => { counts.forward++; } };
  const policy = { mode: "CAPTURE_ONLY", rscCaptureOnce: true, rscMetadataOnly: false, freshIsolatedContext: true, productionExcluded: true, page, onRscIrrelevant: (record) => nonfatal.push(record), ...policyOverrides };
  const handler = createCaptureHandler(targetProof, { token: sentinel, claims: targetClaims }, state, (record) => captures.push(record), new Map(), policy);
  return { request, route, handler, state, counts, captures, nonfatal, frame, page, policy };
}
const first = fixture();
await first.handler(first.route);
assert.equal(first.state.stopped, false);
assert.equal(first.state.firstRefusal, null);
assert.equal(first.state.rscNonfatalBlockCount, 1);
assert.equal(first.captures.length, 0);
assert.equal(first.nonfatal.length, 1);
assert.equal(first.nonfatal[0].networkDecision, "BLOCKED");
assert.equal(first.nonfatal[0].captureControl, "NONFATAL_IRRELEVANT_BLOCK");
assert.equal(first.nonfatal[0].guardResult, "OUT_OF_SCOPE_PATH_BLOCKED");
assert.equal(first.nonfatal[0].rscAbortConfirmed, true);
assert.equal(first.counts.abort, 1);
assert.equal(first.counts.forward, 0);
assert.equal(first.counts.headerAttachments, 0);
assert.equal(first.counts.bodies, 1);
assert.equal(JSON.stringify(first.nonfatal).includes(sentinel), false);
assert.throws(() => assertRequest(proof, first.request.url()), (error) => safeCode(error) === "OUT_OF_SCOPE_PATH_BLOCKED");
checks += 15;
console.log("FIRST_EXACT_RSC_NONFATAL=PASS");
first.request.url = () => `${PIN.url}/?_rsc=ANOTHER_SYNTHETIC_CACHE_KEY`;
await first.handler(first.route);
assert.equal(first.state.stopped, true);
assert.equal(first.state.rscNonfatalBlockCount, 1);
assert.equal(first.captures.length, 1);
assert.equal(first.nonfatal.length, 1);
assert.equal(first.counts.abort, 2);
assert.equal(first.counts.forward, 0);
assert.equal(first.captures[0].rscPredicates.FIRST_ROOT_RSC_ONLY, false);
checks += 7;
console.log("REPEATED_RSC_FATAL=PASS");

async function expectFatal(overrides = {}, options = {}, targetProof = proof, targetClaims = claims) {
  const test = fixture(overrides, options, targetProof, targetClaims);
  await test.handler(test.route);
  assert.equal(test.state.stopped, true);
  assert.equal(test.state.rscNonfatalBlockCount, 0);
  assert.equal(test.counts.abort, 1);
  assert.equal(test.counts.forward, 0);
  assert.equal(test.counts.headerAttachments, 0);
  assert.equal(test.nonfatal.length, 0);
  assert.equal(test.captures.length, 1);
  assert.equal(JSON.stringify(test.captures).includes(sentinel), false);
  checks += 8;
  return test;
}
await expectFatal({ headersArray: async () => [] });
await expectFatal({ resourceType: () => "xhr" });
await expectFatal({ url: () => `${PIN.url}/forgot-password?_rsc=SYNTHETIC` });
console.log("ORDINARY_FETCH_FATAL=PASS");
await expectFatal({ url: () => `${PIN.url}/api/auth/session` });
await expectFatal({ url: () => `${PIN.url}/login` });
console.log("AUTH_FETCH_FATAL=PASS");
await expectFatal({ url: () => "https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", method: () => "POST" });
console.log("SUPABASE_AUTH_FATAL=PASS");
for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]) {
  const test = await expectFatal({ method: () => method });
  assert.equal(test.counts.bodies, 0); checks++;
}
const post = await expectFatal({ url: () => `${PIN.url}/login`, method: () => "POST", headersArray: async () => [{ name: "next-action", value: sentinel }] });
assert.equal(post.captures[0].guardResult, "PASS");
assert.equal(post.captures[0].serverActionHeaderPresent, true);
assert.equal(post.captures[0].captureAbortReason, "CAPTURE_ONLY_MUTATION_ABORT");
checks += 3;
console.log("POST_SERVER_ACTION_FATAL=PASS");
await expectFatal({ url: () => "https://fulfillment-management-platform-q39nhsf03.vercel.app/?_rsc=SYNTHETIC" });
await expectFatal({}, {}, { ...proof, deploymentId: "dpl_OTHER_SYNTHETIC" });
console.log("OTHER_DEPLOYMENT_FATAL=PASS");
await expectFatal({ url: () => "https://production.invalid/?_rsc=SYNTHETIC" });
await expectFatal({}, { productionExcluded: false });
console.log("PRODUCTION_FATAL=PASS");
await expectFatal({ url: () => "https://unknown.invalid/?_rsc=SYNTHETIC" });
console.log("UNKNOWN_EXTERNAL_FATAL=PASS");

for (const extra of ["authorization", "cookie", "x-vercel-trusted-oidc-idp-token", "x-vercel-protection-bypass", "x-api-key", "unknown-header", "next-action", "next-router-state-tree", "content-length"]) {
  await expectFatal({ headersArray: async () => [...exactNames, extra].map((name) => ({ name, value: sentinel })) });
}
for (const missing of exactNames) await expectFatal({ headersArray: async () => exactNames.filter((name) => name !== missing).map((name) => ({ name, value: sentinel })) });
await expectFatal({ headersArray: async () => { throw Error(sentinel); } });
const opaqueBody = new Proxy({}, { get() { throw Error("BODY_CONTENTS_MUST_NOT_BE_READ"); } });
await expectFatal({ postDataBuffer: () => opaqueBody });
await expectFatal({ postDataBuffer: () => { throw Error(sentinel); } });
await expectFatal({ isNavigationRequest: () => true });
await expectFatal({ resourceType: () => "document" });
await expectFatal({ serviceWorker: () => ({}) });
await expectFatal({ serviceWorker: () => { throw Error(sentinel); } });
await expectFatal({ redirectedFrom: () => ({ url: () => `${PIN.url}/another`, redirectedFrom: () => null }) });
await expectFatal({ redirectedFrom: () => ({ url: () => "https://production.invalid/", redirectedFrom: () => null }) });
for (const url of [`${PIN.url}/`, `${PIN.url}/?_rsc=x&_rsc=y`, `${PIN.url}/?_rsc=x&token=SYNTHETIC`, `${PIN.url}/?_rsc=x#fragment`, `${PIN.url}:444/?_rsc=x`, PIN.url.replace("https:", "http:") + "/?_rsc=x", PIN.url.replace("https://", "https://userinfo@") + "/?_rsc=x"]) await expectFatal({ url: () => url });
for (const options of [{ mode: "RELEASE" }, { rscCaptureOnce: false }, { rscCaptureOnce: undefined }, { rscMetadataOnly: true }, { rscMetadataOnly: undefined }, { freshIsolatedContext: false }]) await expectFatal({}, options);
await expectFatal({}, {}, proof, { ...claims, exp: now - 1 });

// Each recorded fact must be present and identical; derived summaries alone
// cannot substitute for missing/changed raw presence predicates.
const synthetic = fixture();
const metadata = rootRscMetadata(proof, synthetic.request, { headerNames: exactNames, headersKnown: true, navigation: false, redirected: false, initiatingPage: `${PIN.url}/login`, frame: synthetic.frame, framePage: synthetic.page, page: synthetic.page, freshIsolatedContext: true });
const facts = { metadata, mode: "CAPTURE_ONLY", enabled: true, metadataOnly: false, stopped: false, firstRefusal: null, occurrenceCount: 0, originalDecision: "OUT_OF_SCOPE_PATH_BLOCKED", url: synthetic.request.url(), method: "GET", resourceType: "fetch", applicationPage: `${PIN.url}/login`, serviceWorker: false, productionExcluded: true };
assert.equal(rootRscCaptureEligibility(proof, claims, facts).eligible, true); checks++;
for (const key of Object.keys(metadata)) {
  const missing = { ...metadata }; delete missing[key];
  assert.equal(rootRscCaptureEligibility(proof, claims, { ...facts, metadata: missing }).eligible, false); checks++;
  if (typeof metadata[key] === "boolean") {
    assert.equal(rootRscCaptureEligibility(proof, claims, { ...facts, metadata: { ...metadata, [key]: !metadata[key] } }).eligible, false); checks++;
  }
}
for (const key of Object.keys(facts)) {
  const missing = { ...facts }; delete missing[key];
  assert.equal(rootRscCaptureEligibility(proof, claims, missing).eligible, false); checks++;
}
for (const key of Object.keys(PIN)) { assert.equal(rootRscCaptureEligibility({ ...proof, [key]: "wrong" }, claims, facts).eligible, false); checks++; }
assert.equal(rootRscCaptureEligibility({ ...proof, checkedAt: Date.now() - 600001 }, claims, facts).eligible, false); checks++;
const abortFailure = fixture();
abortFailure.route.abort = async () => { throw Error(sentinel); };
await abortFailure.handler(abortFailure.route);
assert.equal(abortFailure.state.stopped, true);
assert.equal(abortFailure.state.rscNonfatalBlockCount, 0);
assert.equal(abortFailure.nonfatal.length, 0);
assert.equal(abortFailure.counts.forward, 0);
assert.equal(abortFailure.captures[0].captureAbortReason, "RSC_ABORT_NOT_CONFIRMED");
checks += 5;
const source = readFileSync(new URL("./protected-preview-rsc-policy.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /route\.continue|headersArray|\.postData|CredRead|credentialFromLauncher|storageState/); checks++;
console.log(`EXACT_RSC_POLICY_CHECKS=${checks}`);
console.log("HOSTED_REQUESTS_DURING_POLICY_TESTS=0");
console.log("NETWORK_GUARD_EXPANSIONS=0");
