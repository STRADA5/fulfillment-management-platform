// Offline synthetic DOM fixtures only; never inspect a hosted hidden value.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";
import { PIN, childEnvironment, localEvidence } from "../phase6/hosted-auth-smoke.mjs";
import { createCaptureHandler, redactUrl } from "./protected-preview-capture.mjs";
import { runSyntheticSubmit, submitSyntheticLoginForm } from "./protected-preview-synthetic-submit.mjs";

localEvidence();
let checks = 0; const eq = (a, b) => { assert.deepEqual(a, b); checks++; };
const proof = { ...PIN, checkedAt: Date.now() }; const now = Date.now() / 1000;
const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, owner: PIN.team, owner_id: PIN.teamId,
  project: PIN.project, project_id: PIN.projectId, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, environment: "development", iat: now - 1, exp: now + 3600 };
const oidc = { token: "OFFLINE_ONLY", claims };
const ready = () => ({ interceptionArmed: true, stopped: false, firstRefusal: null, syntheticSubmitCount: 0, loginResponseObserved: true,
  forgotNonfatalBlockCount: 1, forgotIrrelevantRefusal: { forgotPasswordAbortConfirmed: true,
    forgotPasswordMetadata: { purposeClassification: "AUTOMATIC_FRAMEWORK_PREFETCH", observation: { loginHydrated: true } } } });
const source = submitSyntheticLoginForm.toString();
const recognition = source.slice(source.indexOf("const actionControls"), source.indexOf("if (document.querySelector"));
assert.doesNotMatch(recognition, /\.value\b|defaultValue|\.attributes\b|getAttribute\(|setAttribute\(|removeAttribute\(|\.remove\(|appendChild|FormData|\.disabled\s*=/); checks++;
eq((source.match(/\.value\s*=(?!=)/g) ?? []).length, 2);
assert.match(source, /email\.value = `phase7-capture-/); checks++;
assert.match(source, /password\.value = `capture-only-/); checks++;
eq((source.match(/form\.requestSubmit\(\)/g) ?? []).length, 1);

const variants = ["verified", "unknown-hidden", "csrf", "partial", "duplicate", "mixed-prefix", "extra-action", "visible-action", "disabled-action",
  "required-action", "readonly-action", "other-form", "outside-form", "captcha", "iframe", "sitekey", "hidden-email", "hidden-password", "no-root-index", "unknown-action-name", "explicit-role"];
function fixture(variant) {
  let fields = ["$ACTION_REF_0", "$ACTION_0:0", "$ACTION_0:1", "$ACTION_KEY"].map(name => ({ name, type: "hidden", attrs: "" }));
  if (variant === "partial") fields.pop();
  if (variant === "duplicate") fields[2].name = "$ACTION_0:0";
  if (variant === "mixed-prefix") fields[2].name = "$ACTION_1:1";
  if (variant === "no-root-index") fields[1].name = "$ACTION_0:2";
  if (variant === "unknown-action-name") fields[0].name = "$ACTION_SECRET";
  if (variant === "visible-action") fields[0].type = "text";
  if (variant === "disabled-action") fields[0].attrs = "disabled";
  if (variant === "required-action") fields[0].attrs = "required";
  if (variant === "readonly-action") fields[0].attrs = "readonly";
  if (variant === "explicit-role") fields[0].attrs = 'role="presentation"';
  if (variant === "other-form") fields[0].attrs = 'form="other"';
  for (const [kind, name] of [["unknown-hidden", "unknown"], ["csrf", "csrf_token"], ["extra-action", "$ACTION_ID_0"]]) {
    if (variant === kind) fields.push({ name, type: "hidden", attrs: "" });
  }
  const html = field => `<input type="${field.type}" name="${field.name}" ${field.attrs} value="OFFLINE_HIDDEN_SENTINEL">`;
  const outside = variant === "outside-form" ? html({ ...fields.shift(), attrs: 'form="login"' }) : "";
  const challenge = variant === "captcha" ? '<div class="h-captcha"></div>' : variant === "iframe" ? '<iframe></iframe>' : variant === "sitekey" ? '<div data-sitekey="OFFLINE_ONLY"></div>' : "";
  return `<!doctype html><form id="other"></form>${outside}<form id="login">${fields.map(html).join("")}
    <input type="hidden" name="next" value="OFFLINE_HIDDEN_SENTINEL">
    <input id="email" name="email" type="email" required${variant === "hidden-email" ? " hidden" : ""}>
    <input id="password" name="password" type="password" required${variant === "hidden-password" ? ' style="opacity:0"' : ""}>
    <button type="submit">Sign in</button></form>${challenge}
    <script>
    const form=document.querySelector('#login');form.__reactProps$test={action(){}};
    const hiddenNodes=[...document.querySelectorAll('input[type="hidden"]')];
    const originalForms=hiddenNodes.map(field=>field.form);
    const proof={hiddenReads:0,hiddenWrites:0,hiddenAttributeReads:0,hiddenAttributeWrites:0,hiddenMutations:0,emailWrites:0,passwordWrites:0,otherWrites:0};
    for(const property of ['value','defaultValue']){
      const descriptor=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,property);
      Object.defineProperty(HTMLInputElement.prototype,property,{...descriptor,
        get(){if(this.type==='hidden'){proof.hiddenReads++;throw Error('HIDDEN_VALUE_READ_FORBIDDEN');}return descriptor.get.call(this);},
        set(next){if(this.type==='hidden'){proof.hiddenWrites++;throw Error('HIDDEN_VALUE_WRITE_FORBIDDEN');}
          if(this===document.querySelector('#email'))proof.emailWrites++;
          else if(this===document.querySelector('#password'))proof.passwordWrites++;
          else{proof.otherWrites++;throw Error('UNAPPROVED_INPUT_WRITE');}return descriptor.set.call(this,next);}});
    }
    const originalGet=Element.prototype.getAttribute;
    Element.prototype.getAttribute=function(name){if(this instanceof HTMLInputElement&&this.type==='hidden'&&name.toLowerCase()==='value'){proof.hiddenAttributeReads++;throw Error('HIDDEN_ATTRIBUTE_READ_FORBIDDEN');}return originalGet.call(this,name);};
    for(const method of ['setAttribute','removeAttribute']){
      const original=Element.prototype[method];Element.prototype[method]=function(...args){if(hiddenNodes.includes(this)){proof.hiddenAttributeWrites++;throw Error('HIDDEN_ATTRIBUTE_WRITE_FORBIDDEN');}return original.apply(this,args);};
    }
    const observe=records=>{for(const record of records){if(hiddenNodes.includes(record.target)||[...record.removedNodes,...record.addedNodes].some(node=>hiddenNodes.some(field=>node===field||node.contains?.(field))))proof.hiddenMutations++;}};
    const observer=new MutationObserver(observe);observer.observe(document,{subtree:true,childList:true,attributes:true});
    window.__hiddenProof=()=>{observe(observer.takeRecords());return{...proof,hiddenNodesPreserved:hiddenNodes.every((field,index)=>field.isConnected&&field.form===originalForms[index])};};
    form.addEventListener('submit',event=>{event.preventDefault();fetch(location.href,{method:'POST',headers:{'next-action':'OFFLINE_ACTION'},body:new FormData(form)}).catch(()=>{});});
    </script>`;
}

const proxy = createServer((_req, res) => { res.writeHead(403); res.end(); });
proxy.on("connection", socket => socket.on("error", () => socket.destroy()));
proxy.on("connect", (_req, socket) => socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"));
await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: "msedge", env: childEnvironment(), proxy: { server: `http://127.0.0.1:${proxy.address().port}`, bypass: "<-loopback>" }, args: ["--disable-http2", "--disable-quic", "--force-webrtc-ip-handling-policy=disable_non_proxied_udp"] });
  for (const variant of variants) {
    const context = await browser.newContext({ serviceWorkers: "block", acceptDownloads: false });
    try {
      const page = await context.newPage(); const state = ready(); const records = []; const forms = new Map();
      let armed = false; let requests = 0; let forwarded = 0; let resolveCapture;
      const captured = new Promise(resolve => { resolveCapture = resolve; });
      const handler = createCaptureHandler(proof, oidc, state, record => { records.push(record); resolveCapture(); }, forms, { syntheticSubmitOnce: true });
      await context.route("**/*", async route => {
        if (!armed && route.request().url() === `${PIN.url}/login` && route.request().method() === "GET") {
          await route.fulfill({ status: 200, contentType: "text/html", body: fixture(variant) });
        } else if (armed) {
          requests++;
          await handler({ request: () => route.request(), abort: () => route.abort(), continue: async () => { forwarded++; await route.abort(); throw Error("NETWORK_FORWARD_FORBIDDEN"); } });
        } else { await route.abort(); }
      });
      await page.goto(`${PIN.url}/login`, { waitUntil: "networkidle" });
      armed = true;
      if (variant === "verified") {
        const result = await runSyntheticSubmit(page, state, proof, claims, forms, redactUrl);
        eq(result.frameworkHiddenControlsRecognized, true); eq(result.visibleLoginFieldsVerified, true); eq(result.invoked, true); eq(result.submitEvent, true);
        let timer;
        try { await Promise.race([captured, new Promise((_, reject) => { timer = setTimeout(() => reject(Error("OFFLINE_AUTH_CAPTURE_MISSING")), 5000); })]); }
        finally { clearTimeout(timer); }
        eq(requests, 1); eq(records.length, 1); eq(records[0].authRequestAbortConfirmed, true);
        eq(records[0].syntheticSubmissionMetadata.requestBodyPresent, true); eq(records[0].syntheticSubmissionMetadata.serverAction, true);
        eq(JSON.stringify([result, records]).includes("OFFLINE_HIDDEN_SENTINEL"), false);
        eq(JSON.stringify([result, records]).includes("phase7-capture-"), false);
        eq(JSON.stringify([result, records]).includes("capture-only-"), false);
      } else {
        const code = variant.startsWith("hidden-") ? "SYNTHETIC_VISIBLE_FIELDS_UNVERIFIED" : "SYNTHETIC_ADDITIONAL_CONTROL_REQUIREMENT";
        await assert.rejects(runSyntheticSubmit(page, state, proof, claims, forms, redactUrl), new RegExp(code)); checks++;
        eq(requests, 0); eq(records.length, 0);
      }
      const cdp = await context.newCDPSession(page);
      const observed = await cdp.send("Runtime.evaluate", { expression: "window.__hiddenProof()", returnByValue: true, userGesture: false });
      eq(observed.result.value, { hiddenReads: 0, hiddenWrites: 0, hiddenAttributeReads: 0, hiddenAttributeWrites: 0, hiddenMutations: 0,
        emailWrites: variant === "verified" ? 1 : 0, passwordWrites: variant === "verified" ? 1 : 0, otherWrites: 0, hiddenNodesPreserved: true });
      await cdp.detach(); eq(forwarded, 0);
    } finally { await context.close(); }
  }
} finally {
  if (browser) await browser.close(); proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve));
}
console.log(`Framework-hidden regression safety: PASS (${checks} checks; ${variants.length} offline Edge contexts; hidden reads/writes: 0; auth transmissions: 0).`);
