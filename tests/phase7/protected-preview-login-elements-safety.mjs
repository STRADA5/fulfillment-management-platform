// Offline-only DOM fixtures. No remote requests or field-value reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { PIN, childEnvironment, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { loginElementInventory, inspectLoginElements } from "./protected-preview-login-elements.mjs";

localEvidence();
let checks = 0; const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const proof = { ...PIN, checkedAt: Date.now() }; const now = Date.now() / 1000;
const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId,
  project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 };
const ready = () => ({ interceptionArmed: true, stopped: false, firstRefusal: null, loginResponseObserved: true,
  syntheticSubmitCount: 0, emptyFieldSubmitCount: 0, elementInventoryCount: 0, forgotNonfatalBlockCount: 1,
  forgotIrrelevantRefusal: { forgotPasswordAbortConfirmed: true, forgotPasswordMetadata: { purposeClassification: "AUTOMATIC_FRAMEWORK_PREFETCH" } } });
let calls = 0;
const cdp = { send: async (method, params) => {
  calls++; eq(method, "Runtime.evaluate"); eq(params.userGesture, false); eq(params.awaitPromise, false);
  eq(params.returnByValue, true); eq(params.includeCommandLineAPI, false); eq(params.silent, true);
  return { result: { value: { fieldValuesRead: false } } };
}, detach: async () => {} };
const mockPage = { url: () => `${PIN.url}/login`, context: () => ({ newCDPSession: async () => cdp }) };
for (const change of [{ interceptionArmed: false }, { stopped: true }, { firstRefusal: {} }, { loginResponseObserved: false },
  { syntheticSubmitCount: 1 }, { emptyFieldSubmitCount: 1 }, { elementInventoryCount: 1 }, { forgotNonfatalBlockCount: 0 }, { forgotIrrelevantRefusal: null }]) {
  await assert.rejects(inspectLoginElements(mockPage, { ...ready(), ...change }, proof, claims)); checks++;
}
for (const url of ["https://production.invalid/login", `${PIN.url}/reports`, `${PIN.url}/login?next=anything`]) {
  await assert.rejects(inspectLoginElements({ ...mockPage, url: () => url }, ready(), proof, claims)); checks++;
}
await assert.rejects(inspectLoginElements(mockPage, ready(), { ...proof, commit: "WRONG" }, claims)); checks++;
await assert.rejects(inspectLoginElements(mockPage, ready(), proof, { ...claims, exp: now - 1 })); checks++;
eq(calls, 0);
const state = ready(); await inspectLoginElements(mockPage, state, proof, claims); eq(calls, 1); eq(state.elementInventoryCount, 1);
await assert.rejects(inspectLoginElements(mockPage, state, proof, claims)); checks++;
const source = loginElementInventory.toString();
assert.doesNotMatch(source, /\.value\b|\.validity\b|getAttribute\(["']value|innerHTML|outerHTML|\.click\(|\.focus\(|dispatchEvent\(|requestSubmit\(|\.submit\(|\.fetch\(|setAttribute\(|removeAttribute\(|localStorage|sessionStorage|document\.cookie/); checks++;
const guardedSource = readFileSync(new URL("./protected-preview-synthetic-submit.mjs", import.meta.url), "utf8");
const exactPredicate = 'field !== email && field !== password &&\n    !(field instanceof HTMLInputElement && field.type === "hidden" && field.name === "next" && !field.required) &&\n    !(field instanceof HTMLButtonElement && field.type === "submit" && !field.disabled && !field.formNoValidate)';
const normalized = text => text.replace(/\s+/g, " ");
assert.ok(normalized(source).includes(normalized(exactPredicate))); checks++;
assert.ok(normalized(guardedSource).includes(normalized(exactPredicate))); checks++;
const runner = readFileSync(new URL("./protected-preview-capture.mjs", import.meta.url), "utf8");
const branch = runner.slice(runner.indexOf("if (loginElementsOnly) {"), runner.indexOf("if (syntheticSubmitOnce) {"));
assert.match(branch, /return; \/\/ Metadata only/); checks++;
assert.doesNotMatch(branch, /runSyntheticSubmit|runEmptyFieldSubmit|\.evaluate\(|\.goto\(|\.value\b/); checks++;

const proxy = createServer((_req, res) => { res.writeHead(403); res.end(); });
proxy.on("connection", socket => socket.on("error", () => socket.destroy()));
proxy.on("connect", (_req, socket) => socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"));
await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "msedge", env: childEnvironment(), proxy: { server: `http://127.0.0.1:${proxy.address().port}`, bypass: "<-loopback>" }, args: ["--disable-http2", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
  for (const [variant, extra, buttonAttribute, formUnexpected, challengeMatches] of [
    ["normal", "", "", 0, 0],
    ["action-key", '<input type="hidden" name="$ACTION_KEY" value="PRIVATE_SENTINEL">', "", 1, 0],
    ["action-id", '<input type="hidden" name="$ACTION_ID_PRIVATE_SENTINEL" value="PRIVATE_SENTINEL">', "", 1, 0],
    ["csrf", '<input type="hidden" name="csrf_token" value="PRIVATE_SENTINEL">', "", 1, 0],
    ["fieldset", '<fieldset></fieldset>', "", 1, 0],
    ["disabled", "", "disabled", 1, 0],
    ["iframe", '<iframe title="PRIVATE_SENTINEL"></iframe>', "", 0, 1],
    ["captcha", '<div class="h-captcha" data-sitekey="PRIVATE_SENTINEL"></div>', "", 0, 1],
  ]) {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    try {
      const page = await context.newPage(); let inspectionStarted = false; let requestsDuringInspection = 0;
      await context.route("**/*", async route => {
        if (inspectionStarted) requestsDuringInspection++;
        if (!inspectionStarted && route.request().url() === `${PIN.url}/login` && route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "text/html", body: `<!doctype html><form><input type="hidden" name="next" value="PRIVATE_SENTINEL">
            <label for="email">Email address</label><input id="email" name="email" type="email" required value="PRIVATE_SENTINEL">
            <label for="password">Password</label><input id="password" name="password" type="password" required value="PRIVATE_SENTINEL">
            ${extra}<button type="submit" ${buttonAttribute}>Sign in</button></form><a href="/forgot-password">Forgot your password?</a>
            <script>document.querySelector('form').__reactProps$test={action(){}};
            window.__offlineEvents={input:0,focus:0,click:0,submit:0,valueReads:0};
            for(const name of ['input','focus','click','submit'])addEventListener(name,()=>window.__offlineEvents[name]++,true);
            Object.defineProperty(HTMLInputElement.prototype,'value',{get(){window.__offlineEvents.valueReads++;throw Error('FIELD_READ_FORBIDDEN');},set(){throw Error('FIELD_WRITE_FORBIDDEN');}});
            const originalAttribute=Element.prototype.getAttribute;Element.prototype.getAttribute=function(name){if(name.toLowerCase()==='value')throw Error('FIELD_ATTRIBUTE_READ_FORBIDDEN');return originalAttribute.call(this,name);};
            </script>` });
        } else { await route.abort(); }
      });
      await page.goto(`${PIN.url}/login`, { waitUntil: "networkidle" });
      inspectionStarted = true;
      const result = await inspectLoginElements(page, ready(), proof, claims);
      eq(result.fieldValuesRead, false); eq(result.isActive, false); eq(result.hasBeenActive, false);
      eq(result.unexpectedFormControlCount, formUnexpected); eq(result.documentSelectorMatchCount, challengeMatches);
      eq(result.guardTriggered, formUnexpected + challengeMatches > 0); eq(result.reactActionIsFunction, true);
      eq(result.elements.filter(item => item.triggeringUnexpectedFormControl).length, formUnexpected);
      eq(result.elements.filter(item => item.triggeringDocumentSelector).length, challengeMatches);
      eq(JSON.stringify(result).includes("PRIVATE_SENTINEL"), false);
      if (variant === "action-key") eq(result.elements.find(item => item.name === "$ACTION_KEY").frameworkActionName, true);
      if (variant === "action-id") eq(result.elements.find(item => item.name === "$ACTION_ID_[REDACTED]").frameworkActionName, true);
      const verifyCdp = await context.newCDPSession(page);
      const observations = await verifyCdp.send("Runtime.evaluate", { expression: "window.__offlineEvents", returnByValue: true, userGesture: false });
      eq(observations.result.value, { input: 0, focus: 0, click: 0, submit: 0, valueReads: 0 });
      await verifyCdp.detach(); eq(requestsDuringInspection, 0);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close(); proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve));
}
console.log(`Login-element metadata safety: PASS (${checks} checks; eight offline Edge contexts; field-value reads: 0; input/submits: 0; hosted requests: 0).`);
