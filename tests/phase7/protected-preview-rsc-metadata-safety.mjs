// Offline tests only: synthetic requests, no provider/browser/credential access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIN, assertRequest, safeCode, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { isExactRootRscRequest, rootRscMetadata, waitForRscMetadataStop } from "./protected-preview-rsc-metadata.mjs";
import { createCaptureHandler } from "./protected-preview-capture.mjs";

localEvidence();
const proof = { ...PIN, checkedAt: Date.now() };
const now = Date.now() / 1000;
const oidc = { token: "SYNTHETIC_NOT_REAL", claims: { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 } };
const sentinel = "SENSITIVE_TEST_SENTINEL_NEVER_EMIT";
let checks = 0;
function fixture(overrides = {}, factOverrides = {}) {
  const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0, irrelevantBlockCount: 0, hydrationCompleted: false, emptyFormConstruction: false };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const counts = { abort: 0, forward: 0, bodies: 0 };
  const request = {
    url: () => `${PIN.url}/?_rsc=${sentinel}`, method: () => "GET", resourceType: () => "fetch",
    headersArray: async () => ["rsc", "next-router-prefetch", "next-router-state-tree"].map((name) => ({ name, value: sentinel })),
    headers: () => { throw Error("HEADERS_MUST_NOT_BE_ATTACHED"); },
    postDataBuffer: () => { counts.bodies++; return null; },
    isNavigationRequest: () => false, frame: () => frame, redirectedFrom: () => null, serviceWorker: () => null,
    ...overrides,
  };
  const facts = { headerNames: ["rsc", "next-router-prefetch", "next-router-state-tree"], headersKnown: true, navigation: false, redirected: false, initiatingPage: `${PIN.url}/login`, frame, framePage: page, page, freshIsolatedContext: true, ...factOverrides };
  const captures = [];
  const route = { request: () => request, abort: async () => { counts.abort++; }, continue: async () => { counts.forward++; } };
  const handler = createCaptureHandler(proof, oidc, state, (record) => captures.push(record), new Map(), { mode: "CAPTURE_ONLY", page, freshIsolatedContext: true, rscMetadataOnly: true });
  return { request, facts, counts, state, captures, route, handler };
}
const exact = fixture();
await exact.handler(exact.route);
assert.equal(exact.state.stopped, true);
assert.equal(exact.counts.abort, 1);
assert.equal(exact.counts.forward, 0);
assert.equal(exact.counts.bodies, 1);
assert.equal(exact.captures.length, 1);
const captured = exact.captures[0];
assert.equal(captured.captureControl, "FATAL_OR_AUTH_CAPTURE_STOP");
assert.equal(captured.captureAbortReason, "OUT_OF_SCOPE_PATH_BLOCKED");
assert.equal(captured.rscAbortConfirmed, true);
assert.equal(captured.rscMetadata.allReviewedConditionsProven, true);
assert.equal(captured.rscMetadata.requestBodyPresent, false);
assert.equal(captured.rscMetadata.anonymousVerified, true);
assert.equal(JSON.stringify(captured).includes(sentinel), false);
assert.throws(() => assertRequest(proof, exact.request.url()), (error) => safeCode(error) === "OUT_OF_SCOPE_PATH_BLOCKED");
checks += 13;
await exact.handler(exact.route);
assert.equal(exact.counts.abort, 2);
assert.equal(exact.counts.forward, 0);
assert.equal(exact.counts.bodies, 1);
assert.equal(exact.captures.length, 1);
checks += 4;

// Confirm the exact name comes from the installed, deployed-lock-compatible
// framework's fetch construction. Never inspect a real header value.
const installedNext = JSON.parse(readFileSync(new URL("../../node_modules/next/package.json", import.meta.url), "utf8"));
const frameworkFetch = readFileSync(new URL("../../node_modules/next/dist/client/components/router-reducer/fetch-server-response.js", import.meta.url), "utf8");
assert.equal(installedNext.version, "16.3.1");
assert.match(frameworkFetch, /headers\['x-deployment-id'\] = deploymentId;/);
checks += 2;
const deploymentHeader = fixture({
  headersArray: async () => ["rsc", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "x-deployment-id"].map((name) => ({ name, value: sentinel })),
});
await deploymentHeader.handler(deploymentHeader.route);
const deploymentMetadata = deploymentHeader.captures[0].rscMetadata;
assert.equal(deploymentMetadata.frameworkDeploymentHeaderPresent, true);
assert.equal(deploymentMetadata.unclassifiedHeaderPresent, false);
assert.equal(deploymentMetadata.credentialAbsenceVerified, true);
assert.equal(deploymentMetadata.allReviewedConditionsProven, true);
assert.ok(deploymentMetadata.frameworkHeaderNames.includes("x-deployment-id"));
assert.equal(deploymentHeader.state.stopped, true);
assert.equal(deploymentHeader.counts.abort, 1);
assert.equal(deploymentHeader.counts.forward, 0);
assert.equal(deploymentHeader.captures[0].captureControl, "FATAL_OR_AUTH_CAPTURE_STOP");
assert.equal(JSON.stringify(deploymentHeader.captures).includes(sentinel), false);
checks += 10;
for (const extra of ["x-deployment-id-extra", "x-deployment-token", "x-deployment-authorization", "unrecognized-header"]) {
  const test = fixture({}, { headerNames: [...exact.facts.headerNames, "x-deployment-id", extra] });
  assert.equal(rootRscMetadata(proof, test.request, test.facts).allReviewedConditionsProven, false); checks++;
}
const identityHeaderAlone = fixture({}, { headerNames: ["x-deployment-id"] });
assert.equal(rootRscMetadata(proof, identityHeaderAlone.request, identityHeaderAlone.facts).frameworkPrefetchVerified, false);
assert.equal(rootRscMetadata(proof, identityHeaderAlone.request, identityHeaderAlone.facts).allReviewedConditionsProven, false);
checks += 2;

for (const headerName of ["authorization", "cookie", "x-api-key", "x-vercel-trusted-oidc-idp-token", "x-vercel-protection-bypass", "unknown-custom-header", "next-action"]) {
  const test = fixture({}, { headerNames: [...exact.facts.headerNames, headerName] });
  const metadata = rootRscMetadata(proof, test.request, test.facts);
  assert.equal(metadata.allReviewedConditionsProven, false);
  assert.equal(JSON.stringify(metadata).includes(sentinel), false);
  checks += 2;
}
for (const fact of ["headersKnown", "headerNames", "navigation", "redirected", "initiatingPage", "frame", "framePage", "page", "freshIsolatedContext"]) {
  const test = fixture(); delete test.facts[fact];
  assert.equal(rootRscMetadata(proof, test.request, test.facts).allReviewedConditionsProven, false); checks++;
}
for (const facts of [
  { headerNames: [] }, { headerNames: ["rsc"] }, { headerNames: ["rsc", "next-router-prefetch"] },
  { navigation: true }, { redirected: true }, { initiatingPage: `${PIN.url}/reports` }, { freshIsolatedContext: false },
]) {
  const test = fixture({}, facts);
  assert.equal(rootRscMetadata(proof, test.request, test.facts).allReviewedConditionsProven, false); checks++;
}
const opaqueBody = new Proxy({}, { get() { throw Error("BODY_CONTENTS_READ"); } });
const withBody = fixture({ postDataBuffer: () => opaqueBody });
assert.equal(rootRscMetadata(proof, withBody.request, withBody.facts).requestBodyPresent, true);
assert.equal(rootRscMetadata(proof, withBody.request, withBody.facts).allReviewedConditionsProven, false);
checks += 2;
const unknownBody = fixture({ postDataBuffer: () => { throw Error(sentinel); } });
assert.equal(rootRscMetadata(proof, unknownBody.request, unknownBody.facts).requestBodyPresent, null);
assert.equal(rootRscMetadata(proof, unknownBody.request, unknownBody.facts).bodyAbsenceVerified, false);
checks += 2;
const redirect = fixture({ redirectedFrom: () => ({ url: () => "https://production.invalid/", redirectedFrom: () => null }) }, { redirected: true });
assert.equal(rootRscMetadata(proof, redirect.request, redirect.facts).crossOriginRedirect, true);
assert.equal(rootRscMetadata(proof, redirect.request, redirect.facts).allReviewedConditionsProven, false);
checks += 2;
const unknownRedirect = fixture({ redirectedFrom: () => { throw Error(sentinel); } });
assert.equal(rootRscMetadata(proof, unknownRedirect.request, unknownRedirect.facts).crossOriginRedirect, null);
assert.equal(rootRscMetadata(proof, unknownRedirect.request, unknownRedirect.facts).allReviewedConditionsProven, false);
checks += 2;

for (const [url, method, resourceType] of [
  [`${PIN.url}/login`, "GET", "fetch"], [`${PIN.url}/`, "GET", "fetch"], [`${PIN.url}/?_rsc=x&_rsc=y`, "GET", "fetch"],
  [`${PIN.url}/?_rsc=x&token=${sentinel}`, "GET", "fetch"], [`${PIN.url}/?_rsc=x`, "POST", "fetch"],
  [`${PIN.url}/?_rsc=x`, "HEAD", "fetch"], [`${PIN.url}/?_rsc=x`, "GET", "xhr"], [`${PIN.url}/?_rsc=x`, "GET", "document"],
  ["https://production.invalid/?_rsc=x", "GET", "fetch"], ["https://other-preview.invalid/?_rsc=x", "GET", "fetch"],
  ["https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", "POST", "fetch"],
]) {
  const test = fixture({ url: () => url, method: () => method, resourceType: () => resourceType });
  assert.equal(isExactRootRscRequest(proof, url, method, resourceType), false);
  assert.equal(rootRscMetadata(proof, test.request, test.facts), null);
  assert.equal(test.counts.bodies, 0);
  checks += 3;
}
const failedAbort = fixture();
failedAbort.route.abort = async () => { throw Error(sentinel); };
await failedAbort.handler(failedAbort.route);
assert.equal(failedAbort.captures[0].rscAbortConfirmed, false);
assert.equal(failedAbort.state.stopped, true);
assert.equal(failedAbort.counts.forward, 0);
checks += 3;

await waitForRscMetadataStop({ stopped: true }, new Promise(() => {}), 1);
await waitForRscMetadataStop({ stopped: false }, Promise.resolve(), 10);
await assert.rejects(waitForRscMetadataStop({ stopped: false }, new Promise(() => {}), 1), /RSC_METADATA_REQUEST_NOT_OBSERVED/);
checks += 3;
const source = readFileSync(new URL("./protected-preview-capture.mjs", import.meta.url), "utf8");
const metadataSource = readFileSync(new URL("./protected-preview-rsc-metadata.mjs", import.meta.url), "utf8");
assert.match(source, /if \(rscMetadataOnly\) \{\s+await waitForRscMetadataStop\(state, stopped\);\s+return;/);
assert.ok(source.indexOf("await waitForRscMetadataStop(state, stopped)") < source.indexOf('emit("HYDRATION_WAIT"'));
assert.ok(source.indexOf("await waitForRscMetadataStop(state, stopped)") < source.indexOf("form.requestSubmit()"));
assert.doesNotMatch(metadataSource, /\.postData\(|\.postDataJSON|headersArray|\.headers\(|\.value\b|route\.continue|credentialFromLauncher|CredRead|storageState/);
checks += 4;
console.log(`RSC metadata-only offline safety: PASS (${checks} checks; requests forwarded: 0; hosted access: 0).`);
