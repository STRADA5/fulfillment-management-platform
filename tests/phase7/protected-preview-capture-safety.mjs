// Offline capture safety: fake requests, no CLI, browser login, credentials or network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIN, assertRequest, safeCode } from "../phase6/hosted-auth-smoke.mjs";
import { redactUrl, requestDiagnostic, captureDecision, createCaptureHandler, loginHydrationReady } from "./protected-preview-capture.mjs";

const proof = { ...PIN, checkedAt: Date.now() };
const now = Date.now() / 1000;
const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 };
const oidc = { token: "OFFLINE_TEST_ONLY", claims };
let checks = 0;
function hydrationFixture() {
  const current = { memoizedState: { isDehydrated: false } };
  const form = { "__reactProps$test": { action() {} }, "__reactFiber$test": { tag: 5, return: { tag: 3, stateNode: { current } } } };
  const email = { value: "", form };
  const password = { value: "", form };
  return { current, form, email, password, document: { querySelector: (selector) => selector === "input#email" ? email : password } };
}
assert.equal(loginHydrationReady(hydrationFixture().document), true); checks++;
for (const mutation of [
  (fixture) => { delete fixture.form.__reactProps$test; },
  (fixture) => { fixture.form.__reactProps$test.action = "/login"; },
  (fixture) => { delete fixture.form.__reactFiber$test; },
  (fixture) => { fixture.current.memoizedState.isDehydrated = true; },
  (fixture) => { fixture.password.form = {}; },
  (fixture) => { fixture.email.value = "NOT_EMPTY_TEST_ONLY"; },
  (fixture) => { fixture.password.value = "NOT_EMPTY_TEST_ONLY"; },
]) {
  const fixture = hydrationFixture(); mutation(fixture);
  assert.equal(loginHydrationReady(fixture.document), false); checks++;
}
for (const raw of [
  `${PIN.url}/login`, "https://production.invalid/login", "https://vercel.live/_next-live/feedback/feedback.js",
  `${PIN.url}:444/login`, PIN.url.replace("https:", "http:") + "/login",
  PIN.url.replace("https://", "https://private-user:private-password@") + "/login",
  `${PIN.url}/login#private-fragment`, "/login", `${PIN.url}/login?token=private-token`,
  "https://nftufhffzlokryafcbku.supabase.co/auth/v1/token?grant_type=private-value",
]) {
  let expected = "PASS";
  try { assertRequest(proof, raw, "POST"); } catch (error) { expected = safeCode(error); }
  const result = requestDiagnostic(proof, raw, "POST");
  assert.equal(result.guardResult, expected);
  if (expected === "OFF_TARGET_REQUEST_BLOCKED") {
    const first = Object.entries(result.guardPredicates).find(([, passed]) => !passed)[0];
    assert.equal(result.firstFailedPredicate, first);
  }
  checks++;
}
const privateUrl = "https://private-user:private-password@example.invalid/auth/v1/token?access_token=private-token&email=private%40example.invalid#private-fragment";
const sanitized = JSON.stringify(requestDiagnostic(proof, privateUrl, "POST", { initiatingPage: privateUrl, baseUrl: privateUrl, originalUrlForm: "RELATIVE", resourceType: "fetch" }));
for (const secret of ["private-user", "private-password", "private-token", "private-fragment", "private%40", "private@example"]) assert.equal(sanitized.includes(secret), false);
assert.deepEqual(redactUrl(privateUrl).queryNames, ["access_token", "email"]);
assert.equal(redactUrl("data:text/plain,private-token").pathname, "[REDACTED_NON_HTTP_PATH]");
assert.equal(redactUrl("https://example.invalid/private%40example.invalid/sk_test_hidden").pathname, "/[REDACTED]/[REDACTED]");
checks += 9;

function fakeRoute(url, method, overrides = {}) {
  const observations = { aborted: 0, continued: 0 };
  const request = {
    url: () => url, method: () => method, resourceType: () => "fetch", headers: () => ({}),
    frame: () => ({ url: () => `${PIN.url}/login` }), redirectedFrom: () => null,
    isNavigationRequest: () => false,
    ...overrides,
  };
  request.headersArray = async () => Object.entries(request.headers()).map(([name, value]) => ({ name, value }));
  // No body-reading API is provided: accidental access makes the test fail.
  return { request: () => request, abort: async () => { observations.aborted++; }, continue: async () => { observations.continued++; }, observations };
}
for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
  for (const raw of [`${PIN.url}/login`, "https://production.invalid/login", "https://nftufhffzlokryafcbku.supabase.co/auth/v1/token"]) {
    const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0 };
    const captured = [];
    const handler = createCaptureHandler(proof, oidc, state, (metadata) => captured.push(metadata));
    const route = fakeRoute(raw, method);
    await handler(route);
    assert.equal(route.observations.continued, 0);
    assert.equal(route.observations.aborted, 1);
    assert.equal(captured.length, 1);
    assert.equal(state.stopped, true);
    const subsequent = fakeRoute(`${PIN.url}/login`, "GET");
    await handler(subsequent);
    assert.equal(subsequent.observations.continued, 0);
    assert.equal(captured.length, 1);
    assert.equal(state.firstRefusal, captured[0]);
    checks++;
  }
}
for (const [url, method, expected] of [
  [`${PIN.url}/login`, "GET", "ALLOW_LOGIN_GET_OR_ASSET"],
  [`${PIN.url}/_next/static/chunks/test.js`, "GET", "ALLOW_LOGIN_GET_OR_ASSET"],
  [`${PIN.url}/login`, "POST", "CAPTURE_ONLY_MUTATION_ABORT"],
  [`${PIN.url}/salespeople`, "GET", "CAPTURE_ONLY_NAVIGATION_ABORT"],
  [`${PIN.url}/reports`, "GET", "CAPTURE_ONLY_NAVIGATION_ABORT"],
  ["https://production.invalid/login", "GET", "OFF_TARGET_REQUEST_BLOCKED"],
]) { assert.equal(captureDecision(proof, url, method), expected); checks++; }
const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0 };
const handler = createCaptureHandler(proof, oidc, state, () => assert.fail("GET should be allowed"));
const readOnly = fakeRoute(`${PIN.url}/login`, "GET", { resourceType: () => "document", isNavigationRequest: () => true });
await handler(readOnly);
assert.equal(readOnly.observations.continued, 1);
assert.equal(readOnly.observations.aborted, 0);
checks++;

const hydratedState = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0, hydrationCompleted: true, emptyFormConstruction: true };
const urlForms = new Map([[`${PIN.url}/login`, { form: "RELATIVE", base: `${PIN.url}/login` }]]);
const hydratedRoute = fakeRoute(`${PIN.url}/login`, "POST", { headers: () => ({ "next-action": "OPAQUE_TEST_IDENTIFIER_DO_NOT_LOG" }) });
await createCaptureHandler(proof, oidc, hydratedState, () => {}, urlForms)(hydratedRoute);
assert.equal(hydratedRoute.observations.continued, 0);
assert.equal(hydratedRoute.observations.aborted, 1);
assert.equal(hydratedState.firstRefusal.hydratedAuthRequestCaptured, true);
assert.equal(hydratedState.firstRefusal.initiatorCategory, "NEXTJS_SERVER_ACTION_FETCH");
assert.equal(hydratedState.firstRefusal.originalUrlForm, "RELATIVE");
assert.equal(hydratedState.firstRefusal.guardResult, "PASS");
assert.equal(JSON.stringify(hydratedState.firstRefusal).includes("OPAQUE_TEST_IDENTIFIER_DO_NOT_LOG"), false);
checks += 7;

const source = readFileSync(new URL("./protected-preview-capture.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /credentialFromLauncher|--credential-pipe|CredRead|\.postData\(|\.postDataJSON|\.allHeaders|storageState|recordHar|tracing\.start|screenshot\(/);
// Only a null-presence test is permitted, solely on the known GET script. No body contents.
assert.equal((source.match(/\.postDataBuffer/g) ?? []).length, 1);
assert.match(source, /bodyAbsent = request.postDataBuffer\(\) === null/);
assert.match(source, /email.value = ""; password.value = ""/);
assert.match(source, /captureDecision\(proof, request.url\(\), request.method\(\)\)/);
assert.match(source, /createPinnedProxy\(proof\)/);
assert.match(source, /liveProof\(cli\)/);
assert.match(source, /assertOidcClaims\(oidc.claims\)/);
assert.match(source, /serviceWorkers: "block"/);
assert.match(source, /routeWebSocket/);
assert.match(source, /"--disable-http2", "--disable-quic"/);
assert.match(source, /page.waitForFunction\(loginHydrationReady/);
assert.match(source, /await window.__p7CaptureUrlForm/);
assert.match(source, /requireCheck\(await page.evaluate\(loginHydrationReady\)/);
checks += 12;
console.log(`Capture-only offline safety: PASS (${checks} checks; POSTs forwarded: 0; remote connections: 0).`);
