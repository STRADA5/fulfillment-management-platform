// Local synthetic fixtures only; every browser request is fulfilled or aborted.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { PIN, childEnvironment, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { createCaptureHandler, redactUrl } from "./protected-preview-capture.mjs";
import { assertSyntheticPreflight, submitSyntheticLoginForm, runSyntheticSubmit, syntheticFailureCode } from "./protected-preview-synthetic-submit.mjs";

localEvidence();
const proof = { ...PIN, checkedAt: Date.now() }; const now = Date.now() / 1000;
const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId,
  project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 };
const oidc = { token: "OFFLINE_ONLY", claims };
const ready = () => ({ interceptionArmed: true, stopped: false, firstRefusal: null, syntheticSubmitCount: 0, loginResponseObserved: true,
  forgotNonfatalBlockCount: 1, forgotIrrelevantRefusal: { forgotPasswordAbortConfirmed: true,
    forgotPasswordMetadata: { purposeClassification: "AUTOMATIC_FRAMEWORK_PREFETCH", observation: { loginHydrated: true } } } });
let checks = 0; const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
let calls = 0; let bindings = 0; let bindingCallback;
const frame = {};
const pageMock = { url: () => `${PIN.url}/login`, mainFrame: () => frame,
  exposeBinding: async (name, callback) => { eq(name, "__p7SyntheticUrlForm"); bindings++; bindingCallback = callback; },
  evaluate: async (fn, args) => { calls++; eq(fn, submitSyntheticLoginForm); eq(args, { origin: PIN.url }); return { invoked: true }; } };
for (const mutate of [
  s => { s.interceptionArmed = false; }, s => { s.stopped = true; }, s => { s.firstRefusal = {}; }, s => { s.syntheticSubmitCount = 1; },
  s => { s.loginResponseObserved = false; }, s => { s.forgotNonfatalBlockCount = 0; }, s => { s.forgotNonfatalBlockCount = 2; },
  s => { s.forgotIrrelevantRefusal.forgotPasswordAbortConfirmed = false; },
  s => { s.forgotIrrelevantRefusal.forgotPasswordMetadata.purposeClassification = "UNKNOWN"; },
  s => { s.forgotIrrelevantRefusal.forgotPasswordMetadata.observation.loginHydrated = false; },
]) {
  const state = ready(); mutate(state);
  await assert.rejects(runSyntheticSubmit(pageMock, state, proof, claims, new Map(), redactUrl), /SYNTHETIC_PREFLIGHT_UNVERIFIED/); checks++;
}
for (const url of [`${PIN.url}/reports`, `${PIN.url}/login?extra=1`, "https://production.invalid/login"]) {
  assert.throws(() => assertSyntheticPreflight({ ...pageMock, url: () => url }, ready(), proof, claims)); checks++;
}
assert.throws(() => assertSyntheticPreflight(pageMock, ready(), { ...proof, commit: "WRONG" }, claims)); checks++;
assert.throws(() => assertSyntheticPreflight(pageMock, ready(), proof, { ...claims, exp: now - 30 })); checks++;
eq(calls, 0); eq(bindings, 0);
const once = ready(); const forms = new Map();
await runSyntheticSubmit(pageMock, once, proof, claims, forms, redactUrl);
eq(calls, 1); eq(bindings, 1); eq(once.syntheticSubmitCount, 1); eq(once.hydrationCompleted, true);
bindingCallback({ page: pageMock, frame }, { url: `${PIN.url}/login`, base: `${PIN.url}/login`, form: "ABSOLUTE" });
eq(forms.get(`${PIN.url}/login`), { form: "ABSOLUTE", base: `${PIN.url}/login` });
assert.throws(() => bindingCallback({ page: {}, frame }, {}), /SYNTHETIC_METADATA_STOPPED/); checks++;
await assert.rejects(runSyntheticSubmit(pageMock, once, proof, claims, forms, redactUrl)); checks++;
eq(calls, 1);
const raced = ready();
await assert.rejects(runSyntheticSubmit({ ...pageMock, exposeBinding: async () => { raced.stopped = true; } }, raced, proof, claims, new Map(), redactUrl)); checks++;
eq(calls, 1); eq(raced.syntheticSubmitCount, 0);
eq(syntheticFailureCode(Error("page.evaluate: Error: SYNTHETIC_ADDITIONAL_CONTROL_REQUIREMENT")), "SYNTHETIC_ADDITIONAL_CONTROL_REQUIREMENT");
eq(syntheticFailureCode(Error("UNREPORTED_PRIVATE_VALUE")), null);

// Actual capture handler, no network: submit state never grants transmission.
for (const [url, method, type, headers, nav, redirect] of [
  [`${PIN.url}/login`, "POST", "fetch", ["next-action"], false, false],
  [`${PIN.url}/login`, "POST", "document", [], true, false],
  [`${PIN.url}/login`, "GET", "fetch", [], false, false],
  [`${PIN.url}/login`, "GET", "xhr", [], false, false],
  [`${PIN.url}/login`, "GET", "document", [], true, true],
  [`${PIN.url}/login`, "GET", "image", ["authorization"], false, false],
  [`${PIN.url}/login`, "GET", "image", ["cookie"], false, false],
  [`${PIN.url}/login`, "GET", "image", ["next-action"], false, false],
  [`${PIN.url}/api/auth/session`, "GET", "fetch", [], false, false],
  ["https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", "POST", "fetch", [], false, false],
  ["https://production.invalid/login", "POST", "fetch", [], false, false],
  ["https://unknown.invalid/login", "GET", "document", [], true, false],
]) {
  const state = { ...ready(), syntheticSubmitCount: 1, hydrationCompleted: true, loginNavigationSeen: true };
  const counts = { aborted: 0, forwarded: 0, attached: 0 };
  const request = { url: () => url, method: () => method, resourceType: () => type, frame: () => ({ url: pageMock.url, page: () => pageMock }),
    headersArray: async () => headers.map(name => ({ name, value: "REDACTION_SENTINEL" })),
    headers: () => { counts.attached++; throw Error("ATTACHMENT_FORBIDDEN"); },
    postDataBuffer: () => method === "POST" ? new Proxy({}, { get() { throw Error("BODY_READ_FORBIDDEN"); } }) : null,
    isNavigationRequest: () => nav, redirectedFrom: () => redirect ? { url: pageMock.url, redirectedFrom: () => null } : null };
  const route = { request: () => request, abort: async () => { counts.aborted++; }, continue: async () => { counts.forwarded++; } };
  const records = [];
  await createCaptureHandler(proof, oidc, state, r => records.push(r), forms, { syntheticSubmitOnce: true })(route);
  eq(counts, { aborted: 1, forwarded: 0, attached: 0 }); eq(state.stopped, true); eq(records.length, 1);
  eq(records[0].authRequestAbortConfirmed, true); eq(records[0].syntheticRequestConstructionEntered, true);
  eq(records[0].syntheticSubmissionMetadata.requestBodyPresent, method === "POST");
  eq(JSON.stringify(records).includes("REDACTION_SENTINEL"), false);
}

const source = readFileSync(new URL("./protected-preview-synthetic-submit.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /CredRead|credentialFromLauncher|process\.env|\.noValidate\s*=(?!=)|removeAttribute\(|preventDefault\(|\.click\(|\.fill\(|\.submit\(|\.postData\(|\.postDataJSON|localStorage|sessionStorage|console\./); checks++;
eq((submitSyntheticLoginForm.toString().match(/form\.requestSubmit\(\)/g) ?? []).length, 1);
eq((submitSyntheticLoginForm.toString().match(/\.value\s*=(?!=)/g) ?? []).length, 2);
const runner = readFileSync(new URL("./protected-preview-capture.mjs", import.meta.url), "utf8");
const branch = runner.slice(runner.indexOf("if (syntheticSubmitOnce) {"), runner.indexOf("if (emptyFieldSubmitOnce) {"));
assert.match(branch, /return; \/\/ Never enter any other submit mode/); checks++;
assert.doesNotMatch(branch, /noValidate|credentialFromLauncher|\.goto\(/); checks++;

// Offline browser validation and first-request abort with the actual capture
// handler; pinned Preview URLs here are fulfilled locally, never connected to.
const proxy = createServer((_req, res) => { res.writeHead(403); res.end(); });
// A browser may reset a deliberately denied connection. This offline proxy has
// no upstream connector; consume that socket error without changing any test.
proxy.on("connection", socket => socket.on("error", () => socket.destroy()));
proxy.on("connect", (_req, socket) => socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"));
await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "msedge", env: childEnvironment(), proxy: { server: `http://127.0.0.1:${proxy.address().port}`, bypass: "<-loopback>" }, args: ["--disable-http2", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
  for (const variant of ["normal", "additional-minlength", "additional-control", "validation-disabled", "nonempty", "challenge"]) {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    try {
      const page = await context.newPage(); const state = ready(); const map = new Map(); const records = [];
      let armed = false; let requests = 0; let resolveCapture;
      const captured = new Promise(resolve => { resolveCapture = resolve; });
      const handler = createCaptureHandler(proof, oidc, state, record => { records.push(record); resolveCapture(); }, map, { syntheticSubmitOnce: true });
      await context.route("**/*", async route => {
        if (!armed && route.request().url() === `${PIN.url}/login` && route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><form${variant === "validation-disabled" ? " novalidate" : ""}>
            <input type="hidden" name="next" value="/dashboard">
            <input id="email" name="email" type="email" required${variant === "nonempty" ? ' value="offline@example.invalid"' : ""}>
            <input id="password" name="password" type="password" required${variant === "additional-minlength" ? ' minlength="100"' : ""}>
            ${variant === "additional-control" ? '<input name="challenge" required>' : ""}
            <button type="submit">Sign in</button></form>${variant === "challenge" ? '<div class="h-captcha"></div>' : ""}
            <script>const form=document.querySelector('form');form.__reactProps$test={action(){}};
            form.addEventListener('submit', event=>{event.preventDefault();fetch(location.href,{method:'POST',headers:{'next-action':'OFFLINE_ACTION'},body:new FormData(form)}).catch(()=>{});});</script>` });
        } else if (armed) { requests++; await handler(route); }
        else { await route.abort(); }
      });
      await page.goto(`${PIN.url}/login`, { waitUntil: "networkidle" });
      armed = true;
      if (variant === "normal") {
        const result = await runSyntheticSubmit(page, state, proof, claims, map, redactUrl);
        eq(result, { syntheticValuesOnly: true, emailFormatValid: true, passwordFormatValid: true, validationEnabled: true, formFormatValid: true, submitEvent: true, invoked: true, frameworkHiddenControlsRecognized: false, visibleLoginFieldsVerified: true });
        let timer;
        try { await Promise.race([captured, new Promise((_, reject) => { timer = setTimeout(() => reject(Error("OFFLINE_REQUEST_NOT_CAPTURED")), 5000); })]); }
        finally { clearTimeout(timer); }
        eq(records.length, 1); eq(requests, 1); eq(records[0].method, "POST"); eq(records[0].resolvedOrigin, PIN.url);
        eq(records[0].resolvedPathname, "/login"); eq(records[0].originalUrlForm, "ABSOLUTE");
        eq(records[0].initiatorCategory, "NEXTJS_SERVER_ACTION_FETCH"); eq(records[0].authRequestAbortConfirmed, true);
        eq(records[0].syntheticSubmissionMetadata.formSubmission, true); eq(records[0].syntheticSubmissionMetadata.requestBodyPresent, true);
        eq(JSON.stringify(records).includes("phase7-capture-"), false); eq(JSON.stringify(records).includes("capture-only-"), false);
      } else {
        const code = variant === "additional-minlength" ? "SYNTHETIC_ADDITIONAL_FORMAT_REQUIREMENT" : variant === "validation-disabled" ? "SYNTHETIC_VALIDATION_CONFIG_UNEXPECTED" : variant === "nonempty" ? "SYNTHETIC_NONEMPTY_FIELDS" : "SYNTHETIC_ADDITIONAL_CONTROL_REQUIREMENT";
        await assert.rejects(runSyntheticSubmit(page, state, proof, claims, map, redactUrl), new RegExp(code)); checks++;
        eq(requests, 0); eq(records.length, 0);
      }
      eq(state.syntheticSubmitCount, 1);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close();
  proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve));
}
console.log(`Synthetic-submit safety: PASS (${checks} checks; six offline Edge contexts; hosted requests: 0; auth transmissions: 0).`);
