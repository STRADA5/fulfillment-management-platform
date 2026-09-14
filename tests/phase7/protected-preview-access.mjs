// Offline policy + loopback proxy regressions. No Vercel, Supabase or credential access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { PIN, assertEvidence, assertDeployment, assertProof, assertRequest, assertTunnel, assertOidcClaims, childEnvironment, createPinnedProxy, safeCode } from "../phase6/hosted-auth-smoke.mjs";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const config = JSON.parse(read("config/phase7-acceptance.json"));
const ci = JSON.parse(read("docs/phase7-ci-release-evidence.json"));
assert.equal(assertEvidence(config, ci), PIN);
const project = { id: PIN.projectId, name: PIN.project, accountId: PIN.teamId, ssoProtection: { deploymentType: "all_except_custom_domains" }, oidcTokenConfig: { enabled: true, issuerMode: "team" }, targets: { production: { id: "dpl_test_production", url: "production.invalid", alias: ["production.invalid"] } } };
const team = { id: PIN.teamId, slug: PIN.team };
const deployment = { projectId: PIN.projectId, team: { id: PIN.teamId }, id: PIN.deploymentId, url: new URL(PIN.url).hostname, meta: { gitCommitSha: PIN.commit }, target: null, readyState: "READY" };
const proof = assertDeployment(deployment, project, team);
let checks = 1;
function rejects(callback) { assert.throws(callback); checks += 1; }
for (const [field, bad] of [["previewUrl", "https://stale.invalid"], ["deploymentId", "dpl_wrong"], ["deployedCommit", ci.candidate.commit], ["target", "Production"], ["productionDeployed", true]]) {
  const changed = structuredClone(config); changed.targetIdentity.currentPreviewDeployment[field] = bad;
  rejects(() => assertEvidence(changed, ci));
}
for (const mutation of [
  (d) => { d.projectId = "prj_wrong"; },
  (d) => { d.team.id = "team_wrong"; },
  (d) => { d.id = "dpl_wrong"; },
  (d) => { d.url = "production.invalid"; },
  (d) => { d.meta.gitCommitSha = ci.candidate.commit; },
  (d) => { d.meta.githubCommitSha = "0".repeat(40); },
  (d) => { d.target = "production"; },
  (d) => { delete d.target; },
  (d) => { d.customEnvironment = { slug: "other" }; },
  (d) => { d.readyState = "BUILDING"; },
]) { const changed = structuredClone(deployment); mutation(changed); rejects(() => assertDeployment(changed, project, team)); }
for (const mutation of [
  (p) => { p.id = "prj_wrong"; },
  (p) => { p.name = "wrong"; },
  (p) => { p.accountId = "team_wrong"; },
  (p) => { p.ssoProtection = null; },
  (p) => { p.oidcTokenConfig.enabled = false; },
  (p) => { p.oidcTokenConfig.issuerMode = "global"; },
  (p) => { p.targets.production.url = deployment.url; },
  (p) => { p.targets.production.alias.push(deployment.url); },
]) { const changed = structuredClone(project); mutation(changed); rejects(() => assertDeployment(deployment, changed, team)); }
rejects(() => assertDeployment(deployment, project, { ...team, slug: "other" }));
for (const key of Object.keys(PIN)) rejects(() => assertProof({ ...proof, [key]: "wrong" }));
rejects(() => assertProof({ ...proof, checkedAt: Date.now() - 600001 }));

for (const raw of ["https://production.invalid/login", "https://vercel.com/sso-api", `${PIN.url}.evil.invalid/login`, `${PIN.url}:444/login`, PIN.url.replace("https:", "http:") + "/login", PIN.url.replace("https://", "https://user@") + "/login", `${PIN.url}/login?token=not-a-real-token`, `${PIN.url}/api/private`, `${PIN.url}/forgot-password`, `${PIN.url}/salespeople?salespersonId=unassigned`, `${PIN.url}/%2fadministration`]) {
  rejects(() => assertRequest(proof, raw));
}
for (const method of ["POST", "PUT", "DELETE", "PATCH"]) rejects(() => assertRequest(proof, `${PIN.url}/reports`, method));
assert.equal(assertRequest(proof, `${PIN.url}/login`, "POST").pathname, "/login");
assert.equal(assertRequest(proof, `${PIN.url}/reports?_rsc=test`).pathname, "/reports");
assert.equal(assertRequest(proof, `${PIN.url}/_next/static/chunks/test.js`).origin, PIN.url);
rejects(() => assertTunnel(proof, "production.invalid:443"));
rejects(() => assertTunnel(proof, `${deployment.url}:80`));
rejects(() => assertTunnel(proof, `${deployment.url}.evil.invalid:443`));

const now = Date.now() / 1000;
const claims = { iss: `https://oidc.vercel.com/${PIN.team}`, aud: `https://vercel.com/${PIN.team}`, sub: `owner:${PIN.team}:project:${PIN.project}:environment:development`, owner: PIN.team, owner_id: PIN.teamId, project: PIN.project, project_id: PIN.projectId, environment: "development", iat: now - 1, exp: now + 3600 };
assertOidcClaims(claims, now);
for (const key of ["iss", "aud", "sub", "owner", "owner_id", "project", "project_id", "environment"]) rejects(() => assertOidcClaims({ ...claims, [key]: "production" }, now));
rejects(() => assertOidcClaims({ ...claims, exp: now - 1 }, now));
rejects(() => assertOidcClaims({ ...claims, nbf: now + 100 }, now));
const environment = childEnvironment({ PATH: "local", VERCEL_AUTOMATION_BYPASS_SECRET: "test-sentinel", VERCEL_TOKEN: "test-sentinel", DEBUG: "pw:*", NODE_OPTIONS: "--inspect", HTTPS_PROXY: "https://production.invalid", SUPABASE_SERVICE_ROLE_KEY: "test-sentinel", PHASE7_PREVIEW_URL: "https://production.invalid" });
assert.deepEqual(environment, { PATH: "local" });
assert.equal(safeCode(new Error("secret-test-sentinel")), "UNEXPECTED_RUNNER_ERROR");

// Prove a forbidden CONNECT request never invokes the upstream connector (and
// therefore cannot perform DNS or transmit TLS/headers/passwords to Production).
let connects = 0;
const proxy = await createPinnedProxy(proof, () => { connects += 1; throw Error("must not connect"); });
try {
  for (const authority of ["production.invalid:443", "127.0.0.1:54322", `${deployment.url}.evil.invalid:443`, `${deployment.url}:80`]) {
    const status = await new Promise((accept, reject) => {
      const request = http.request(proxy.url, { method: "CONNECT", path: authority });
      request.on("connect", (response, socket) => { socket.destroy(); accept(response.statusCode); });
      request.on("error", reject); request.end();
    });
    assert.equal(status, 403); checks += 1;
  }
  assert.equal(connects, 0);
} finally { await proxy.close(); }

const runner = read("tests/phase6/hosted-auth-smoke.mjs");
const launcher = read("tools/run-phase6-hosted-smoke.ps1");
for (const source of [runner, launcher]) {
  assert.doesNotMatch(source, /5uxw6i3a|PHASE6_CLIENT_[AB]_CREDENTIAL_TARGET|x-vercel-set-bypass-cookie/);
  assert.doesNotMatch(source, /(?:recordHar|recordVideo|storageState|screenshot|tracing\.start)\s*[:(]/);
}
assert.match(runner, /assertRequest\(currentProof, request.url\(\), request.method\(\)\)/);
assert.match(runner, /loginPosts === 0/);
assert.match(runner, /proxy: \{ server: proxy.url, bypass: "<-loopback>" \}/);
assert.match(runner, /routeWebSocket/);
assert.match(runner, /serviceWorkers: "block"/);
assert.match(runner, /emit\("APP_LOGIN"\)[\s\S]*record = await credentialFromLauncher\(\)/);
assert.match(launcher, /Set-StrictMode -Version Latest/);
assert.match(launcher, /CredRead\("FMP-P6S-STAGING-SALES_A", 1, 0/);
assert.doesNotMatch(launcher, /CredWrite|SendInput|Set-Clipboard/);
assert.equal(fileURLToPath(root).replaceAll("\\", "/").endsWith("fulfillment-management-platform/"), true);
console.log(`Protected Preview offline safety regressions: PASS (${checks} refusal/identity checks; rejected upstream connections: ${connects}).`);
