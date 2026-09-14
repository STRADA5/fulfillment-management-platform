// Offline only. Synthetic fixtures plus real Edge/CDP behind a deny-all proxy.
// No provider access, tokens, credentials or application login.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { EventEmitter } from "node:events";
import { chromium } from "@playwright/test";
import { PIN, childEnvironment, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { createCaptureHandler } from "./protected-preview-capture.mjs";
import { passiveForgotObserver, attachTransport, passiveForgotMetadata } from "./protected-preview-passive-observer.mjs";

localEvidence();
const proof = { ...PIN, checkedAt: Date.now() };
const now = Date.now() / 1000;
const oidc = { token: "SYNTHETIC_ONLY", claims: { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 } };
const sentinel = "SYNTHETIC_SECRET_NEVER_EMIT";
const names = ["rsc", "next-router-prefetch", "next-router-segment-prefetch", "next-url", "x-deployment-id"];
const clean = { mainFrame: true, pageStillLogin: true, isActive: false, hasBeenActive: false, userGestureSeen: false, anyClickSeen: false, forgotLinkClickSeen: false, focusSeen: false, keyboardSeen: false, pointerSeen: false, formSubmitSeen: false, navigationObserverAvailable: true, routeNavigationSeen: false, programmaticNavigationSeen: false, observationError: false, forgotLinkPresent: true, forgotLinkVisible: true, forgotLinkReactBound: true, forgotLinkPrefetchNotDisabled: true, loginHydrated: true, documentLoading: false };
const evidence = { baseline: { ...clean }, before: { ...clean }, transportComplete: true, sameMainFrame: true, requestCorrelationVerified: true, scriptInitiator: true, approvedScriptInInitiator: true, foreignScriptInInitiator: false, browserHasUserGesture: false };
let checks = 0;
const eq = (a, b) => { assert.deepEqual(a, b); checks++; };

// Test-only operation assertion: pre-document registration is not runtime
// evaluation. Exempt ONLY its exact CDP name; its passive parameters are checked
// below. This assertion does not grant network access or change runner policy.
function assertNoActiveObserverOperation(methods) {
  for (const method of methods) {
    if (method === "Page.addScriptToEvaluateOnNewDocument") continue;
    assert.equal(/evaluate|callFunctionOn|^Runtime\.(?:runScript|compileScript)$|^Input\.|click|focus|keyboard|mouse|pointer|dispatchEvent|requestSubmit|(?:^|\.)(?:fill|press|type|tap|check|uncheck|selectOption|setInputFiles|submit|goto|navigate|navigateToHistoryEntry|reload|goBack|goForward)(?:$|\.)|location|history/i.test(method), false, `Active observer operation rejected: ${method}`);
  }
}

function fixture(overrides = {}, factOverrides = {}, observed = evidence) {
  const state = { stopped: false, firstRefusal: null, forwardedReadOnlyRequests: 0, hydrationCompleted: false, emptyFormConstruction: false, irrelevantBlockCount: 0, rscNonfatalBlockCount: 0, loginResponseObserved: true };
  const frame = { url: () => `${PIN.url}/login`, page: () => page };
  const page = { url: () => `${PIN.url}/login`, mainFrame: () => frame };
  const counts = { abort: 0, forward: 0, headerAttachments: 0 };
  const request = {
    url: () => `${PIN.url}/forgot-password?_rsc=${sentinel}`, method: () => "GET", resourceType: () => "fetch",
    headersArray: async () => names.map((name) => ({ name, value: sentinel })),
    headers: () => { counts.headerAttachments++; throw Error("NO_HEADERS_ALLOWED"); },
    postDataBuffer: () => null, isNavigationRequest: () => false, redirectedFrom: () => null,
    frame: () => frame, serviceWorker: () => null, ...overrides,
  };
  const facts = { headerNames: names, headersKnown: true, navigation: false, redirected: false, frame, framePage: page, page, initiatingPage: `${PIN.url}/login`, freshIsolatedContext: true, passiveOnly: true, loginResponseObserved: true, ...factOverrides };
  const captured = [];
  const route = { request: () => request, abort: async () => { counts.abort++; }, continue: async () => { counts.forward++; } };
  const passive = { forRequest: async () => { eq(state.stopped, true); eq(counts.abort, 1); return observed; } };
  const handler = createCaptureHandler(proof, oidc, state, (record) => captured.push(record), new Map(), { mode: "CAPTURE_ONLY", page, productionExcluded: true, freshIsolatedContext: true, rscCaptureOnce: true, rscMetadataOnly: false, forgotMetadataOnly: true, passiveForgotObserver: passive });
  return { state, counts, request, route, facts, captured, handler };
}

const positive = fixture();
eq(passiveForgotMetadata(proof, positive.request, positive.facts, evidence).purposeClassification, "AUTOMATIC_FRAMEWORK_PREFETCH");
await positive.handler(positive.route);
eq(positive.captured[0].captureControl, "FATAL");
eq(positive.captured[0].networkDecision, "BLOCKED");
eq(positive.captured[0].forgotPasswordAbortConfirmed, true);
eq(positive.state.stopped, true);
eq(positive.state.rscNonfatalBlockCount, 0);
eq(positive.counts.forward, 0);
eq(positive.counts.headerAttachments, 0);
eq(JSON.stringify(positive.captured).includes(sentinel), false);
await positive.handler(positive.route);
eq(positive.counts.abort, 2);
eq(positive.captured.length, 1);

// Every missing/contradictory causal condition must stay UNKNOWN.
for (const phase of ["baseline", "before"]) {
  for (const key of ["isActive", "hasBeenActive", "userGestureSeen", "anyClickSeen", "forgotLinkClickSeen", "focusSeen", "keyboardSeen", "pointerSeen", "formSubmitSeen", "routeNavigationSeen", "programmaticNavigationSeen", "observationError"]) {
    for (const value of [true, undefined]) {
      const bad = { ...evidence, [phase]: { ...clean, [key]: value } };
      eq(passiveForgotMetadata(proof, positive.request, positive.facts, bad).purposeClassification, "UNKNOWN");
    }
  }
  for (const key of ["mainFrame", "pageStillLogin", "navigationObserverAvailable"]) {
    eq(passiveForgotMetadata(proof, positive.request, positive.facts, { ...evidence, [phase]: { ...clean, [key]: false } }).purposeClassification, "UNKNOWN");
  }
}
for (const key of ["transportComplete", "sameMainFrame", "requestCorrelationVerified", "scriptInitiator", "approvedScriptInInitiator"]) {
  eq(passiveForgotMetadata(proof, positive.request, positive.facts, { ...evidence, [key]: false }).purposeClassification, "UNKNOWN");
}
for (const key of ["foreignScriptInInitiator", "browserHasUserGesture"]) {
  for (const value of [true, null]) eq(passiveForgotMetadata(proof, positive.request, positive.facts, { ...evidence, [key]: value }).purposeClassification, "UNKNOWN");
}
for (const changed of [{ loginResponseObserved: false }, { headersKnown: false }, { headerNames: ["rsc"] }, { navigation: true }, { redirected: true }, { passiveOnly: false }, { freshIsolatedContext: false }]) {
  eq(passiveForgotMetadata(proof, positive.request, { ...positive.facts, ...changed }, evidence).purposeClassification, "UNKNOWN");
}
for (const extra of ["authorization", "cookie", "x-api-key", "x-vercel-trusted-oidc-idp-token", "x-vercel-protection-bypass", "unknown-header", "next-action", "content-length"]) {
  const f = fixture({ headersArray: async () => [...names, extra].map((name) => ({ name, value: sentinel })) }, { headerNames: [...names, extra] });
  eq(passiveForgotMetadata(proof, f.request, f.facts, evidence).purposeClassification, "UNKNOWN");
  await f.handler(f.route);
  eq(f.state.stopped, true); eq(f.counts.forward, 0); eq(f.captured[0].captureControl, "FATAL");
  eq(JSON.stringify(f.captured).includes(sentinel), false);
}
for (const postDataBuffer of [() => new Proxy({}, { get() { throw Error("BODY_BYTES_READ"); } }), () => { throw Error(sentinel); }]) {
  const f = fixture({ postDataBuffer });
  eq(passiveForgotMetadata(proof, f.request, f.facts, evidence).purposeClassification, "UNKNOWN");
}
for (const [url, method, resourceType, nav, action] of [
  [`${PIN.url}/forgot-password`, "GET", "document", true, false],
  [`${PIN.url}/forgot-password?_rsc=x`, "GET", "fetch", true, false],
  [`${PIN.url}/login`, "POST", "fetch", false, false],
  [`${PIN.url}/login`, "POST", "document", true, false],
  [`${PIN.url}/login`, "GET", "fetch", false, true],
  [`${PIN.url}/api/auth/session`, "GET", "fetch", false, false],
  ["https://nftufhffzlokryafcbku.supabase.co/auth/v1/token", "POST", "fetch", false, false],
  ["https://production.invalid/forgot-password?_rsc=x", "GET", "fetch", false, false],
  ["https://unknown.invalid/forgot-password?_rsc=x", "GET", "fetch", false, false],
]) {
  const f = fixture({ url: () => url, method: () => method, resourceType: () => resourceType, isNavigationRequest: () => nav, headersArray: async () => [...names, ...(action ? ["next-action"] : [])].map((name) => ({ name, value: sentinel })) });
  await f.handler(f.route);
  eq(f.state.stopped, true); eq(f.counts.forward, 0); eq(f.counts.abort, 1);
  eq(f.captured.length, 1); eq(f.captured[0].captureControl.startsWith("FATAL"), true);
}
const failedAbort = fixture();
failedAbort.route.abort = async () => { failedAbort.counts.abort++; throw Error(sentinel); };
await failedAbort.handler(failedAbort.route);
eq(failedAbort.captured[0].forgotPasswordAbortConfirmed, false);
eq(failedAbort.captured[0].captureAbortReason, "FORGOT_ABORT_NOT_CONFIRMED");
eq(failedAbort.state.stopped, true); eq(failedAbort.counts.forward, 0);

// Protocol configuration and missing notifications fail closed.
const mock = new EventEmitter(); const protocol = [];
mock.send = async (method, params) => { protocol.push({ method, params }); return {}; };
const missing = await attachTransport(mock, PIN.url);
eq(protocol.map((item) => item.method), ["Page.enable", "Runtime.enable", "Network.enable", "Runtime.addBinding", "Page.addScriptToEvaluateOnNewDocument"]);
eq(protocol.at(-1).params.runImmediately, false);
eq(protocol.at(-1).params.includeCommandLineAPI, false);
assert.doesNotThrow(() => assertNoActiveObserverOperation(protocol.map((item) => item.method))); checks++;
// Names only: none of these prohibited operations is executed by the test.
for (const operation of [
  "Runtime.evaluate", "Runtime.callFunctionOn", "Runtime.runScript", "Runtime.compileScript",
  "page.evaluate", "locator.evaluate", "page.evaluateHandle", "locator.evaluateHandle",
  "page.click", "locator.click", "HTMLElement.click", "locator.focus", "DOM.focus",
  "page.keyboard.press", "page.keyboard.type", "page.mouse.move", "page.mouse.click",
  "Input.dispatchKeyEvent", "Input.dispatchMouseEvent", "Input.dispatchTouchEvent",
  "Input.synthesizeTapGesture", "Input.synthesizeScrollGesture", "pointer.down",
  "element.dispatchEvent", "form.requestSubmit", "form.submit", "locator.fill",
  "locator.check", "locator.selectOption", "locator.setInputFiles",
  "page.goto", "Page.navigate", "Page.navigateToHistoryEntry", "page.reload",
  "page.goBack", "page.goForward", "navigation.navigate", "location.assign",
  "location.replace", "location.href", "history.pushState", "history.replaceState",
  "Page.addScriptToEvaluateOnNewDocument.extra",
]) {
  assert.throws(() => assertNoActiveObserverOperation([operation]), /Active observer operation rejected/); checks++;
}
eq((await missing.forRequest(positive.request)).transportComplete, false);
await assert.rejects(attachTransport(mock, "https://production.invalid"), /PASSIVE_OBSERVER_TARGET_REFUSED/); checks++;
const observerSource = passiveForgotObserver.toString();
assert.doesNotMatch(observerSource, /\.click\(|\.focus\(|dispatchEvent\(|requestSubmit\(|\.evaluate\(|\.value\b/); checks++;
const runnerSource = readFileSync(new URL("./protected-preview-capture.mjs", import.meta.url), "utf8");
assert.doesNotMatch(runnerSource, /exposeBinding\("__p7ForgotMetadata"/); checks++;
assert.match(runnerSource, /const passiveForgotMode = forgotMetadataOnly \|\| forgotCaptureOnce;/); checks++;
assert.match(runnerSource, /if \(!passiveForgotMode\) \{\s+await context\.exposeBinding\("__p7CaptureUrlForm"/); checks++;
assert.ok(runnerSource.indexOf("await waitForForgotMetadataStop(state, stopped)") < runnerSource.indexOf("await page.evaluate(loginHydrationReady)")); checks++;

// Actual passive transport test. All browser network is intercepted or denied;
// only synthetic local HTML/script are fulfilled, no upstream sockets created.
const denyProxy = createServer((_req, res) => { res.writeHead(403); res.end(); });
denyProxy.on("connect", (_req, socket) => { socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); });
await new Promise((resolve) => denyProxy.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "msedge", env: childEnvironment(), proxy: { server: `http://127.0.0.1:${denyProxy.address().port}`, bypass: "<-loopback>" }, args: ["--disable-http2", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
  for (const [event, flag] of [[null, null], ["click", "anyClickSeen"], ["focusin", "focusSeen"], ["keydown", "keyboardSeen"], ["pointerdown", "pointerSeen"]]) {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    try {
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page); const sent = [];
      const adapter = { on: (...args) => cdp.on(...args), send: (method, params) => { sent.push(method); return cdp.send(method, params); } };
      const collector = await attachTransport(adapter, "http://127.0.0.1");
      let resolveObserved; let rejectObserved;
      const observed = new Promise((resolve, reject) => { resolveObserved = resolve; rejectObserved = reject; });
      await context.route("**/*", async (route) => {
        try {
          const url = new URL(route.request().url());
          if (url.href === "http://127.0.0.1/login") {
            await route.fulfill({ status: 200, contentType: "text/html", body: '<!doctype html><form><input id="email"><input id="password" type="password"></form><a href="/forgot-password">Forgot password</a><script defer src="/_next/static/passive-test.js"></script>' });
          } else if (url.href === "http://127.0.0.1/_next/static/passive-test.js") {
            await route.fulfill({ status: 200, contentType: "application/javascript", body: `setTimeout(() => {
              const form = document.querySelector('form'); const link = document.querySelector('a');
              form.__reactProps$test = {action(){}};
              form.__reactFiber$test = {tag:3,stateNode:{current:{memoizedState:{isDehydrated:false}}}};
              link.__reactProps$test = {href:'/forgot-password',onClick(){}};
              const contamination = ${JSON.stringify(event)};
              if (contamination) link.dispatchEvent(new Event(contamination,{bubbles:true}));
              fetch('/forgot-password?_rsc=SYNTHETIC', {headers:{rsc:'1','next-router-prefetch':'1','next-router-segment-prefetch':'/_tree'}}).catch(()=>{});
            },100);` });
          } else {
            await route.abort();
            if (url.origin === "http://127.0.0.1" && url.pathname === "/forgot-password") resolveObserved(await collector.forRequest(route.request()));
          }
        } catch (error) { await route.abort().catch(() => {}); rejectObserved(error); }
      });
      await page.goto("http://127.0.0.1/login", { waitUntil: "domcontentloaded" });
      let timer; let actual;
      try { actual = await Promise.race([observed, new Promise((_, reject) => { timer = setTimeout(() => reject(Error("OFFLINE_PASSIVE_CAPTURE_TIMEOUT")), 10000); })]); }
      finally { clearTimeout(timer); }
      eq(actual.baseline.isActive, false); eq(actual.baseline.hasBeenActive, false);
      eq(actual.before.isActive, false); eq(actual.before.hasBeenActive, false);
      eq(actual.transportComplete, true); eq(actual.sameMainFrame, true); eq(actual.requestCorrelationVerified, true);
      eq(actual.scriptInitiator, true); eq(actual.approvedScriptInInitiator, true); eq(actual.foreignScriptInInitiator, false);
      eq(actual.browserHasUserGesture, false); eq(actual.before.loginHydrated, true);
      assertNoActiveObserverOperation(sent); checks++;
      if (flag) eq(actual.before[flag], true);
      const result = passiveForgotMetadata(proof, positive.request, positive.facts, actual);
      eq(result.purposeClassification, flag ? "UNKNOWN" : "AUTOMATIC_FRAMEWORK_PREFETCH");
      eq(JSON.stringify(actual).includes("SYNTHETIC"), false);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close();
  denyProxy.closeAllConnections();
  await new Promise((resolve) => denyProxy.close(resolve));
}
console.log(`Passive runner safety: PASS (${checks} checks; five offline Edge contexts; no hosted captures).`);
