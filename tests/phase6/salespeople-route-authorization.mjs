import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baseUrl = "http://127.0.0.1:3106";
const localStatusCommand = process.platform === "win32"
  ? ["cmd.exe", ["/d", "/s", "/c", "node_modules\\.bin\\supabase.cmd status -o env"]]
  : [resolve("node_modules/.bin/supabase"), ["status", "-o", "env"]];

function localEnvironment() {
  let status;
  try {
    status = execFileSync(localStatusCommand[0], localStatusCommand[1], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    throw new Error("Local Supabase status could not be read.");
  }
  const local = Object.fromEntries([...status.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map((match) => [match[1], match[2]]));
  if (new URL(local.API_URL ?? "http://invalid").hostname !== "127.0.0.1") throw new Error("This regression requires local Supabase only.");
  return local;
}

async function waitForApp() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.ok) return;
    } catch {
      // The local Next server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("Local application did not become ready.");
}

async function signInAndCheck(page, email, password, expectedStatus, label) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30000 });
  const routeChecks = [["/salespeople", /Salespeople & commissions/], ["/pricing-tiers", /Pricing tiers/]];
  if (expectedStatus === 200) routeChecks.push(["/reports", /Sales reporting/]);
  for (const [path, shell] of routeChecks) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), expectedStatus, `${label}: unexpected ${path} response status`);
    const body = await page.locator("body").innerText();
    if (expectedStatus === 404) assert.doesNotMatch(body, shell, `${label}: protected ${path} page shell rendered`);
    if (expectedStatus === 200) assert.match(body, shell, `${label}: authorized ${path} page did not render`);
  }
}

const local = localEnvironment();
const service = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID();
const password = `${randomUUID()}-Aa1!`;
const records = [];
const organizationIds = [];
let app;
let browser;

async function must(promise) {
  const result = await promise;
  if (result.error) throw new Error("Local regression setup failed.");
  return result.data;
}

async function createUser(label) {
  const email = `phase6-route-${label}-${run}@example.test`;
  const user = await must(service.auth.admin.createUser({ email, password, email_confirm: true }));
  records.push({ email, userId: user.user.id });
  return records.at(-1);
}

try {
  const provider = await must(service.from("organizations").insert({
    name: `P6S route provider ${run}`,
    slug: `p6s-route-provider-${run}`,
    organization_type: "fulfillment_company",
    status: "active",
  }).select("id").single());
  organizationIds.push(provider.id);
  const client = await must(service.from("organizations").insert({
    name: `P6S route client ${run}`,
    slug: `p6s-route-client-${run}`,
    organization_type: "client_company",
    parent_organization_id: provider.id,
    status: "active",
  }).select("id").single());
  organizationIds.push(client.id);

  const roleRows = await must(service.from("roles").select("id,code").in("code", ["CLIENT_USER", "STAFF", "ADMIN"]));
  const roleIds = Object.fromEntries(roleRows.map((row) => [row.code, row.id]));
  const clientUser = await createUser("client-b");
  const staffUser = await createUser("salesperson");
  const adminUser = await createUser("admin");
  await must(service.from("organization_memberships").insert([
    { organization_id: client.id, user_id: clientUser.userId, role_id: roleIds.CLIENT_USER, status: "active", is_primary: true },
    { organization_id: provider.id, user_id: staffUser.userId, role_id: roleIds.STAFF, status: "active", is_primary: true },
    { organization_id: provider.id, user_id: adminUser.userId, role_id: roleIds.ADMIN, status: "active", is_primary: true },
  ]));

  app = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3106"], {
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: local.API_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
    },
    stdio: "ignore",
  });
  await waitForApp();

  browser = await chromium.launch({ headless: true, channel: process.env.PHASE6_BROWSER_CHANNEL || "msedge" });
  for (const [record, expectedStatus, label] of [[clientUser, 404, "Client user without salespeople.view"], [staffUser, 200, "Authorized salesperson STAFF"], [adminUser, 200, "Authorized provider ADMIN"]]) {
    const context = await browser.newContext({ baseURL: baseUrl });
    try {
      await signInAndCheck(await context.newPage(), record.email, password, expectedStatus, label);
    } finally {
      await context.close();
    }
  }
  console.log("Phase 6 /salespeople and /pricing-tiers route authorization regressions passed.");
} finally {
  await browser?.close();
  if (app && !app.killed) app.kill();
  for (const record of records) await service.auth.admin.deleteUser(record.userId);
  for (const organizationId of [...organizationIds].reverse()) await service.from("organizations").delete().eq("id", organizationId);
}
