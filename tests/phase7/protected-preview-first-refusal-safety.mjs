// Local-only: actual guard/diagnostic functions + fake request/cleanup objects.
// No browser, Vercel CLI, Credential Manager, hosted service, or database is used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PIN, assertRequest, safeCode, refusalMetadata, firstRefusalLines, createFirstRefusalJournal, abortWithFirstRefusal, assertFinalPage } from "../phase6/hosted-auth-smoke.mjs";

const proof = { ...PIN, checkedAt: Date.now() };
const source = readFileSync(new URL("../phase6/hosted-auth-smoke.mjs", import.meta.url), "utf8");
const launcher = readFileSync(new URL("../../tools/run-phase6-hosted-smoke.ps1", import.meta.url), "utf8");
const hash = (value) => createHash("sha256").update(value).digest("hex");
let checks = 0;
function equal(a, b) { assert.deepEqual(a, b); checks++; }
function refuses(raw, method = "GET") {
  try { assertRequest(proof, raw, method); } catch (error) { return error; }
  assert.fail("Expected guard refusal");
}
const details = { phase: "SALESPERSON_A_IDENTITY", intendedAction: "NAVIGATE", intendedPath: "/salespeople", intendedUrlForm: "RELATIVE", beforeTransmission: true };
const ordinaryExternal = "https://vercel.live/_next-live/feedback/feedback.js";
function fixture(raw = ordinaryExternal, overrides = {}) {
  return {
    url: () => raw, method: () => "GET", resourceType: () => "document",
    frame: () => ({ url: () => `${PIN.url}/dashboard` }),
    isNavigationRequest: () => true, redirectedFrom: () => null,
    // Evidence must not read even the names via header/body APIs, much less values.
    headers() { throw Error("SECRET_API_MUST_NOT_BE_READ"); },
    headersArray() { throw Error("SECRET_API_MUST_NOT_BE_READ"); },
    postData() { throw Error("BODY_MUST_NOT_BE_READ"); },
    postDataBuffer() { throw Error("BODY_MUST_NOT_BE_READ"); },
    ...overrides,
  };
}
const cases = [
  ["NAVIGATION", ordinaryExternal, {}, "ORIGIN_EQUALS_PIN"],
  ["FETCH", ordinaryExternal, { resourceType: () => "fetch", isNavigationRequest: () => false }, "ORIGIN_EQUALS_PIN"],
  ["XHR", ordinaryExternal, { resourceType: () => "xhr", isNavigationRequest: () => false }, "ORIGIN_EQUALS_PIN"],
  ["RSC", `${PIN.url}/reports#secret-fragment?_rsc=no`, { resourceType: () => "fetch", isNavigationRequest: () => false }, "FRAGMENT_ABSENT"],
  ["RSC_QUERY", `${PIN.url}/reports?_rsc=SECRET_QUERY_VALUE#secret-fragment`, { resourceType: () => "fetch", isNavigationRequest: () => false }, "FRAGMENT_ABSENT"],
  ["REDIRECT", ordinaryExternal, { redirectedFrom: () => ({ url() { throw Error("DO_NOT_INSPECT_REDIRECT_SOURCE"); } }) }, "ORIGIN_EQUALS_PIN"],
  ["FORM", ordinaryExternal, { method: () => "POST" }, "ORIGIN_EQUALS_PIN"],
];
const transportLines = [];
for (const [name, raw, overrides, predicate] of cases) {
  const request = fixture(raw, overrides);
  const error = refuses(raw, request.method());
  let publishes = 0; let aborts = 0;
  const journal = createFirstRefusalJournal(() => { publishes++; });
  await abortWithFirstRefusal(journal, request, error, details, async () => {
    // Assert original metadata exists BEFORE abort or any cleanup can run.
    equal(journal.first.CODE, "OFF_TARGET_REQUEST_BLOCKED");
    aborts++;
  });
  const first = journal.first;
  equal(first.ATTRIBUTION, "REQUEST_INTERCEPTION");
  equal(first.PHASE, "SALESPERSON_A_IDENTITY");
  equal(first.INITIATING_ORIGIN, PIN.url);
  equal(first.INITIATING_PATH, "/dashboard");
  equal(first.INTENDED_ACTION, "NAVIGATE");
  equal(first.INTENDED_PATH, "/salespeople");
  equal(first.INTENDED_URL_FORM, "RELATIVE");
  equal(first.ORIGINAL_URL_FORM, "UNKNOWN");
  equal(first.RESOURCE_TYPE, request.resourceType());
  equal(first.METHOD, request.method());
  equal(first.FIRST_FAILED_PREDICATE, predicate);
  equal(first.BEFORE_TRANSMISSION, true);
  equal(first.TARGET_PROTOCOL, "https:");
  equal(first.TARGET_PORT, "443");
  equal(first.TARGET_HOSTNAME, new URL(raw).hostname);
  equal(first.TARGET_ORIGIN, new URL(raw).origin);
  equal(first.TARGET_PATH, new URL(raw).pathname);
  equal(first.GUARD_RULE, "ASSERT_REQUEST_EXACT_TARGET_COMPOUND");
  equal(first.INITIATOR, "UNKNOWN");
  equal(aborts, 1); equal(publishes, 1);
  if (name === "RSC_QUERY") equal(first.RSC_QUERY_PRESENT, true);
  if (name === "REDIRECT") equal(first.REDIRECT, true);
  if (name === "FORM") equal(first.FORM_SUBMISSION, true);
  if (["FETCH", "XHR", "RSC", "RSC_QUERY"].includes(name)) equal(first.FETCH_XHR, true);
  equal(Object.isFrozen(first), true);
  assert.throws(() => { first.TARGET_ORIGIN = "changed"; }, TypeError); checks++;
  assert.throws(() => { journal.first = {}; }, TypeError); checks++;
  equal(Object.values(first).every(v => ["string", "boolean"].includes(typeof v)), true);
  const encoded = JSON.stringify(first);
  const later = fixture(`${PIN.url}/forgot-password`, { resourceType: () => "fetch" });
  await abortWithFirstRefusal(journal, later, refuses(later.url()), { ...details, phase: "REPORTS_SESSION" }, async () => {});
  equal(journal.first, first); equal(JSON.stringify(journal.first), encoded); equal(publishes, 1);
  journal.seal();
  const context = { close: async () => { journal.capture("https://production.invalid/login", refuses("https://production.invalid/login"), { ...details, phase: "CLEANUP" }); } };
  const browser = { close: async () => { journal.capture(ordinaryExternal, new Error("SECRET_CLEANUP_EXCEPTION"), details); } };
  await context.close(); await browser.close();
  equal(journal.first, first); equal(publishes, 1);
  transportLines.push(...firstRefusalLines(first));
  console.log(`FIRST_REFUSAL_${name}=PASS`);
}

// Observe the final page after a navigation without claiming pre-transmission blocking.
const finalJournal = createFirstRefusalJournal();
const finalUrl = `${PIN.url}/salespeople#SECRET_FRAGMENT_VALUE`;
assert.throws(() => assertFinalPage(proof, { url: () => finalUrl }, "/salespeople", finalJournal, { ...details, initiatingPage: `${PIN.url}/dashboard` }), e => safeCode(e) === "OFF_TARGET_REQUEST_BLOCKED"); checks++;
equal(finalJournal.first.ATTRIBUTION, "FINAL_PAGE_VALIDATION");
equal(finalJournal.first.BEFORE_TRANSMISSION, false);
equal(finalJournal.first.FIRST_FAILED_PREDICATE, "FRAGMENT_ABSENT");
equal(finalJournal.first.INITIATOR, "FINAL_PAGE_OBSERVATION");
equal(finalJournal.first.TARGET_PATH, "/salespeople");
transportLines.push(...firstRefusalLines(finalJournal.first));
const cleanClose = createFirstRefusalJournal();
cleanClose.seal(); cleanClose.capture(ordinaryExternal, refuses(ordinaryExternal), details);
equal(cleanClose.first, null);

// Missing/stale metadata never causes credential/header/body reads or skips abort.
const stale = fixture(ordinaryExternal, { frame() { throw Error("stale"); }, resourceType() { throw Error("stale"); }, redirectedFrom() { throw Error("stale"); } });
const staleJournal = createFirstRefusalJournal(); let staleAborts = 0;
await abortWithFirstRefusal(staleJournal, stale, refuses(ordinaryExternal), details, async () => { staleAborts++; throw Error("closed"); });
equal(staleJournal.first.INITIATING_ORIGIN, "REDACTED");
equal(staleJournal.first.RESOURCE_TYPE, "UNKNOWN");
equal(staleJournal.first.REDIRECT, "UNKNOWN"); equal(staleAborts, 1);
const publisherFailure = createFirstRefusalJournal(() => { throw Error("output-closed"); }); let publisherAborts = 0;
await assert.rejects(abortWithFirstRefusal(publisherFailure, fixture(), refuses(ordinaryExternal), details, async () => { publisherAborts++; }), /output-closed/); checks++;
equal(publisherAborts, 1); equal(publisherFailure.first.CODE, "OFF_TARGET_REQUEST_BLOCKED");

// Unknown hosts/segments may contain private identifiers: redact, never serialize.
const secretUrl = "https://PRIVATE_USER:PRIVATE_PASSWORD@private-email.private-token.invalid/PRIVATE_PATH?email=PRIVATE_EMAIL&token=PRIVATE_TOKEN#PRIVATE_COOKIE";
const redacted = refusalMetadata(secretUrl, refuses(secretUrl, "POST"), { ...details, initiatingPage: secretUrl, intendedPath: secretUrl, phase: "PRIVATE_PHASE", intendedAction: "PRIVATE_ACTION", method: "POST", attribution: "REQUEST_INTERCEPTION", requestBody: "PRIVATE_BODY", headers: { Authorization: "PRIVATE_AUTH", Cookie: "PRIVATE_COOKIE" }, credential: "PRIVATE_CREDENTIAL", oidc: "PRIVATE_OIDC", resourceType: "PRIVATE_RESOURCE" });
const serialized = JSON.stringify(redacted);
for (const secret of ["PRIVATE_USER", "PRIVATE_PASSWORD", "private-email", "private-token", "PRIVATE_PATH", "PRIVATE_EMAIL", "PRIVATE_TOKEN", "PRIVATE_COOKIE", "PRIVATE_BODY", "PRIVATE_AUTH", "PRIVATE_CREDENTIAL", "PRIVATE_OIDC", "PRIVATE_PHASE", "PRIVATE_ACTION", "PRIVATE_RESOURCE"]) equal(serialized.includes(secret), false);
equal(redacted.TARGET_HOSTNAME, "REDACTED"); equal(redacted.TARGET_ORIGIN, "REDACTED"); equal(redacted.TARGET_PATH, "/[REDACTED]");
equal(redacted.PREDICATE_USERNAME_ABSENT, false); equal(redacted.PREDICATE_PASSWORD_ABSENT, false);
transportLines.push(...firstRefusalLines(redacted));

for (const raw of ["https://production.invalid/login", "https://unknown.invalid/login", PIN.url.replace("https:", "http:") + "/login", `${PIN.url}:444/login`, PIN.url.replace("https://", "https://PRIVATE_USER@") + "/login", `${PIN.url}/login#PRIVATE_FRAGMENT`]) {
  const e = refuses(raw);
  equal(safeCode(e), "OFF_TARGET_REQUEST_BLOCKED");
  const m = refusalMetadata(raw, e, details);
  equal(Object.entries(m).find(([k,v]) => k.startsWith("PREDICATE_") && !v)[0], `PREDICATE_${m.FIRST_FAILED_PREDICATE}`);
  transportLines.push(...firstRefusalLines(m));
}
for (const [path, method] of [["/login", "GET"], ["/login", "POST"], ["/dashboard", "GET"], ["/salespeople", "GET"], ["/reports?_rsc=opaque", "GET"], ["/_next/static/chunks/test.js", "GET"]]) equal(assertRequest(proof, PIN.url + path, method).origin, PIN.url);
equal(safeCode(refuses(`${PIN.url}/`, "GET")), "OUT_OF_SCOPE_PATH_BLOCKED");
equal(safeCode(refuses(`${PIN.url}/forgot-password`, "GET")), "OUT_OF_SCOPE_PATH_BLOCKED");
equal(safeCode(refuses(ordinaryExternal)), "OFF_TARGET_REQUEST_BLOCKED");

// Byte-identical guard, identity, transport and credential functions prove this
// correction did not silently rewrite access, pinning, redirects or credential logic.
equal(hash(source.slice(source.indexOf("export function assertEvidence"), source.indexOf("// Explicit allowlist"))), "d65328487842032669f0f87613f1d7b57eeeaac188a4b430bd8a7cc504557675");
equal(hash(source.slice(source.indexOf("export async function createPinnedProxy"), source.indexOf("async function credentialFromLauncher"))), "ac1a535949fa6b7f3a38f539d5c2595ea8cdf3f9a49979f65f56a2976b6e781c");
equal(hash(source.slice(source.indexOf("async function credentialFromLauncher"), source.indexOf("function assertAppUrl"))), "36f3225ea072c265ccf54eb331a1a3a93a3d1bccd3757f66665aceab4a9c4b50");
assert.match(source, /policyFailure \?\?= safeCode\(error\)/); checks++;
assert.match(source, /await abortWithFirstRefusal\(firstRefusal, request, error/); checks++;
assert.match(source, /firstRefusal\.first\?\.CODE \?\? safeCode\(error\)/); checks++;
assert.match(source, /finally \{ firstRefusal\.seal\(\);[\s\S]*context\.close\(\)/); checks++;
assert.match(source, /if \(request.headers\(\)\["next-router-prefetch"\] === "1"\) \{ await abortOnce\(\); return; \}/); checks++;
assert.match(source, /let abortTask;\s*const abortOnce = \(\) => abortTask \?\?= Promise.resolve\(\).then\(\(\) => route.abort\(\)\)/); checks++;

// Execute ONLY the actual launcher output-filter branches in a private local
// PowerShell subprocess. No launcher process/credential function is executed.
const filterStart = launcher.indexOf("    } elseif ($line -match '^P7_[A-Z0-9_]+=[A-Z0-9_]+$')");
const filterEnd = launcher.indexOf("    } else {", filterStart);
assert.ok(filterStart >= 0 && filterEnd > filterStart); checks++;
const filter = launcher.slice(filterStart, filterEnd).replace(/^    } elseif/, "if") + "\n} else { throw 'Unrecognized output' }";
const filterCases = [...new Set(transportLines)].map(line => ({ line, expected: true }));
for (const line of ["P7_FIRST_REFUSAL_TARGET_ORIGIN=https://private-email.private-token.invalid", "P7_FIRST_REFUSAL_TARGET_PATH=/login/private-password", "P7_FIRST_REFUSAL_COOKIE=private-cookie", "P7_FIRST_REFUSAL_TARGET_ORIGIN=https://vercel.live@evil.invalid", "P7_FIRST_REFUSAL_TARGET_PATH=/login?password=private-value", "P7_FIRST_REFUSAL_UTC=private-value", "P7_FIRST_REFUSAL_RESOURCE_TYPE=private-value", "P7_FIRST_REFUSAL_TARGET_HOSTNAME=vercel.live.evil.invalid"]) filterCases.push({ line, expected: false });
const script = `Set-StrictMode -Version Latest\n$ErrorActionPreference='Stop'\n$validate={ param([string]$line)\n${filter}\n}\n$cases=[Console]::In.ReadToEnd() | ConvertFrom-Json\n$result=@(foreach($case in $cases){try{[void](& $validate $case.line); $true}catch{$false}})\nConvertTo-Json -Compress -InputObject $result`;
const pwsh = process.env.LOCALAPPDATA ? `${process.env.USERPROFILE}\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\native\\powershell\\pwsh.exe` : "pwsh";
const output = execFileSync(pwsh, ["-NoProfile", "-NonInteractive", "-Command", script], { input: JSON.stringify(filterCases), encoding: "utf8", windowsHide: true, timeout: 30000 });
equal(JSON.parse(output.trim()), filterCases.map(x => x.expected));
console.log(`First-refusal metadata/attribution local regressions: PASS (${checks} checks; ${filterCases.length} launcher-channel cases; hosted requests: 0; credentials read: 0).`);
