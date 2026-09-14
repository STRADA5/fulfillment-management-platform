// Offline only: fake requests and synthetic Edge HTML behind a deny-all proxy.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { PIN, childEnvironment, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { createCaptureHandler } from "./protected-preview-capture.mjs";
import { submitEmptyLoginForm, runEmptyFieldSubmit, nativeValidationPreventedRequest, emptySubmissionRequestMetadata } from "./protected-preview-empty-submit.mjs";

localEvidence();
const proof = { ...PIN, checkedAt: Date.now() };
const now = Date.now() / 1000;
const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 };
const oidc = { token: "OFFLINE_ONLY", claims };
let checks = 0;
const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const readyState = () => ({ interceptionArmed: true, stopped: false, firstRefusal: null, emptyFieldSubmitCount: 0,
  loginResponseObserved: true, forgotNonfatalBlockCount: 1, forgotIrrelevantRefusal: { forgotPasswordAbortConfirmed: true,
    forgotPasswordMetadata: { purposeClassification: "AUTOMATIC_FRAMEWORK_PREFETCH", observation: { loginHydrated: true } } } });

let evaluations = 0;
const mockPage = { url: () => `${PIN.url}/login`, evaluate: async (fn, args) => {
  evaluations++; eq(fn, submitEmptyLoginForm); eq(args, { origin: PIN.url }); return { invoked: true };
} };
for (const mutate of [
  s => { s.interceptionArmed = false; }, s => { s.stopped = true; }, s => { s.firstRefusal = {}; },
  s => { s.emptyFieldSubmitCount = 1; }, s => { s.loginResponseObserved = false; },
  s => { s.forgotNonfatalBlockCount = 0; }, s => { s.forgotNonfatalBlockCount = 2; },
  s => { s.forgotIrrelevantRefusal.forgotPasswordAbortConfirmed = false; },
  s => { s.forgotIrrelevantRefusal.forgotPasswordMetadata.purposeClassification = "UNKNOWN"; },
  s => { s.forgotIrrelevantRefusal.forgotPasswordMetadata.observation.loginHydrated = false; },
]) {
  const state = readyState(); mutate(state);
  await assert.rejects(runEmptyFieldSubmit(mockPage, state, proof, claims), /EMPTY_SUBMIT_INTERCEPTION_OR_PREFLIGHT_UNVERIFIED/); checks++;
}
for (const url of [`${PIN.url}/reports`, `${PIN.url}/login?extra=1`, "https://production.invalid/login"]) {
  await assert.rejects(runEmptyFieldSubmit({ ...mockPage, url: () => url }, readyState(), proof, claims)); checks++;
}
await assert.rejects(runEmptyFieldSubmit(mockPage, readyState(), { ...proof, commit: "WRONG" }, claims)); checks++;
await assert.rejects(runEmptyFieldSubmit(mockPage, readyState(), proof, { ...claims, exp: now - 30 })); checks++;
eq(evaluations, 0);
const once = readyState();
await runEmptyFieldSubmit(mockPage, once, proof, claims);
eq(once.emptyFieldSubmitCount, 1); eq(once.emptyFormConstruction, true); eq(evaluations, 1);
await assert.rejects(runEmptyFieldSubmit(mockPage, once, proof, claims)); checks++;
eq(evaluations, 1);
const failed = readyState();
await assert.rejects(runEmptyFieldSubmit({ ...mockPage, evaluate: async () => { throw Error("OFFLINE_EVALUATION_FAILURE"); } }, failed, proof, claims)); checks++;
eq(failed.emptyFieldSubmitCount, 1);
await assert.rejects(runEmptyFieldSubmit(mockPage, failed, proof, claims)); checks++;
eq(evaluations, 1);

const nativeResult = { emailEmpty: true, passwordEmpty: true, emailValueMissing: true, passwordValueMissing: true,
  validationEnabled: true, emailInvalidEvent: true, passwordInvalidEvent: true, submitEvent: false, invoked: true };
eq(nativeValidationPreventedRequest(nativeResult, { firstRefusal: null }), true);
for (const key of Object.keys(nativeResult)) {
  eq(nativeValidationPreventedRequest({ ...nativeResult, [key]: !nativeResult[key] }, { firstRefusal: null }), false);
  eq(nativeValidationPreventedRequest({ ...nativeResult, [key]: undefined }, { firstRefusal: null }), false);
}
eq(nativeValidationPreventedRequest(nativeResult, { firstRefusal: {} }), false);

// Interception tests: every mutating/auth/fetch/navigation/redirect destination
// aborts before any continue or token attachment. No body contents may be read.
const sentinel = "OFFLINE_SECRET_MUST_NOT_APPEAR";
function routeFixture(url, method, resourceType, headerNames = [], navigation = false, redirected = false, abortFails = false) {
  const counts = { abort: 0, forward: 0, attach: 0 };
  const page = { url: () => `${PIN.url}/login` };
  const frame = { url: page.url, page: () => page };
  const prior = { url: () => "https://unapproved.invalid/login", redirectedFrom: () => null };
  const request = { url: () => url, method: () => method, resourceType: () => resourceType, frame: () => frame,
    headersArray: async () => headerNames.map(name => ({ name, value: sentinel })),
    headers: () => { counts.attach++; throw Error("HEADER_ATTACHMENT_FORBIDDEN"); },
    postDataBuffer: () => method === "POST" ? new Proxy({}, { get() { throw Error("BODY_READ_FORBIDDEN"); } }) : null,
    isNavigationRequest: () => navigation, redirectedFrom: () => redirected ? prior : null };
  const route = { request: () => request, abort: async () => { counts.abort++; if (abortFails) throw Error(sentinel); }, continue: async () => { counts.forward++; } };
  const state = { stopped: false, firstRefusal: null, emptyFieldSubmitCount: 1, emptyFormConstruction: true, loginNavigationSeen: true };
  return { request, route, state, counts };
}
for (const args of [
  [`${PIN.url}/login`, "POST", "fetch", ["next-action"]],
  [`${PIN.url}/login`, "POST", "document", [], true],
  [`${PIN.url}/login`, "GET", "fetch"], [`${PIN.url}/login`, "GET", "xhr"],
  [`${PIN.url}/login`, "GET", "document", [], true],
  [`${PIN.url}/login`, "GET", "document", [], true, true],
  [`${PIN.url}/login`, "GET", "image", ["authorization"]],
  [`${PIN.url}/login`, "GET", "image", ["cookie"]],
  [`${PIN.url}/login`, "GET", "image", ["next-action"]],
  [`${PIN.url}/api/auth/session`, "GET", "fetch"],
  [`${PIN.url}/reports`, "GET", "document", [], true],
  [`${PIN.url}/salespeople`, "GET", "document", [], true],
  ["https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", "POST", "fetch"],
  ["https://production.invalid/login", "POST", "fetch"],
  ["https://unapproved.invalid/login", "GET", "document", [], true],
]) {
  const f = routeFixture(...args); const captured = [];
  await createCaptureHandler(proof, oidc, f.state, r => captured.push(r), new Map(), { emptyFieldSubmitOnce: true })(f.route);
  eq(f.counts, { abort: 1, forward: 0, attach: 0 }); eq(f.state.stopped, true); eq(captured.length, 1);
  eq(captured[0].authRequestAbortConfirmed, true); eq(captured[0].networkDecision, "BLOCKED");
  eq(JSON.stringify(captured).includes(sentinel), false);
  eq(captured[0].emptySubmissionMetadata.requestBodyPresent, args[1] === "POST");
}
const abortFailure = routeFixture(`${PIN.url}/login`, "POST", "fetch", ["next-action"], false, false, true);
await createCaptureHandler(proof, oidc, abortFailure.state, () => {}, new Map(), { emptyFieldSubmitOnce: true })(abortFailure.route);
eq(abortFailure.state.firstRefusal.authRequestAbortConfirmed, false);
eq(abortFailure.state.firstRefusal.captureAbortReason, "AUTH_ABORT_NOT_CONFIRMED");
eq(abortFailure.state.stopped, true); eq(abortFailure.counts.forward, 0);
const metadata = emptySubmissionRequestMetadata(routeFixture(`${PIN.url}/login`, "POST", "fetch", [], false, true).request,
  { headersKnown: true, credentialBearing: false, serverAction: true, navigation: false, redirected: true, submitInvoked: true });
eq(metadata, { requestBodyPresent: true, credentialBearingHeaderPresent: false, formSubmission: true, fetchOrXhr: true,
  serverAction: true, supabaseAuth: false, applicationAuthApi: false, redirectAssociated: true, crossOriginRedirect: true });

const source = readFileSync(new URL("./protected-preview-empty-submit.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /\.value\s*=(?!=)|\.noValidate\s*=(?!=)|setAttribute\(|removeAttribute\(|preventDefault\(|\.click\(|\.focus\(|dispatchEvent\(|checkValidity\(|reportValidity\(|\.fill\(|\.submit\(|credentialFromLauncher|CredRead|\.postData\(|\.postDataJSON|\.allHeaders|storageState|recordHar|screenshot\(/); checks++;
eq((submitEmptyLoginForm.toString().match(/form\.requestSubmit\(\)/g) ?? []).length, 1);
const runner = readFileSync(new URL("./protected-preview-capture.mjs", import.meta.url), "utf8");
const branch = runner.slice(runner.indexOf("if (emptyFieldSubmitOnce) {"), runner.indexOf("if (forgotCaptureOnce) {"));
assert.match(branch, /return; \/\/ Never reach the legacy validation-bypassing diagnostic below/); checks++;
assert.doesNotMatch(branch, /noValidate|\.value\s*=/); checks++;
assert.ok(runner.indexOf("state.interceptionArmed = true") > runner.indexOf('await context.route("**/*"')); checks++;

// Native required-field semantics in an actual browser, not a mocked pass.
const proxy = createServer((_req, res) => { res.writeHead(403); res.end(); });
proxy.on("connect", (_req, socket) => socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"));
await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "msedge", env: childEnvironment(), proxy: { server: `http://127.0.0.1:${proxy.address().port}`, bypass: "<-loopback>" }, args: ["--disable-http2", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
  for (const variant of ["empty", "email-present", "password-present", "validation-disabled", "unhydrated"]) {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    try {
      const page = await context.newPage(); let postCount = 0; let submitPhase = false; let requestAfterSubmit = 0;
      await context.route("**/*", async route => {
        if (submitPhase) requestAfterSubmit++;
        if (route.request().method() === "POST") postCount++;
        if (!submitPhase && route.request().url() === "http://127.0.0.1/login" && route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><form method="post"${variant === "validation-disabled" ? " novalidate" : ""}>
            <input id="email" type="email" required${variant === "email-present" ? ' value="synthetic@example.invalid"' : ""}>
            <input id="password" type="password" required${variant === "password-present" ? ' value="SYNTHETIC_ONLY"' : ""}>
            <button type="submit">Sign in</button></form><script>${variant === "unhydrated" ? "" : "document.querySelector('form').__reactProps$test={action(){}};"}</script>` });
        } else { await route.abort(); }
      });
      await page.goto("http://127.0.0.1/login", { waitUntil: "networkidle" });
      submitPhase = true;
      if (variant === "empty") {
        const actual = await page.evaluate(submitEmptyLoginForm, { origin: "http://127.0.0.1" });
        eq(actual, nativeResult); eq(nativeValidationPreventedRequest(actual, { firstRefusal: null }), true);
        eq(Object.values(actual).every(v => typeof v === "boolean"), true);
      } else {
        const code = variant === "validation-disabled" ? "EMPTY_SUBMIT_VALIDATION_CONFIG_UNEXPECTED" : variant === "unhydrated" ? "EMPTY_SUBMIT_HYDRATION_UNVERIFIED" : "EMPTY_SUBMIT_NONEMPTY_FIELDS";
        await assert.rejects(page.evaluate(submitEmptyLoginForm, { origin: "http://127.0.0.1" }), new RegExp(code)); checks++;
      }
      await new Promise(resolve => setTimeout(resolve, 150));
      eq(postCount, 0); eq(requestAfterSubmit, 0);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close();
  proxy.closeAllConnections();
  await new Promise(resolve => proxy.close(resolve));
}
console.log(`Empty-field capture safety: PASS (${checks} checks; five offline Edge contexts; hosted requests: 0; auth requests transmitted: 0).`);
