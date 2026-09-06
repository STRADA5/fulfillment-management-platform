import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baseUrl = "http://127.0.0.1:3107";
const localStatusCommand = process.platform === "win32"
  ? ["cmd.exe", ["/d", "/s", "/c", "node_modules\\.bin\\supabase.cmd status -o env"]]
  : [resolve("node_modules/.bin/supabase"), ["status", "-o", "env"]];
const privilegedRoutes = ["/administration", "/branding", "/salespeople", "/pricing-tiers", "/client-relationships"];
const clientSideStalePermissions = [
  "administration.access", "memberships.read", "memberships.manage", "roles.read", "roles.manage", "audit.read",
  "branding.read", "salespeople.view", "commissions.view", "pricing_tiers.view", "client_capabilities.view",
];

function localEnvironment() {
  const status = execFileSync(localStatusCommand[0], localStatusCommand[1], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  const local = Object.fromEntries([...status.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map((match) => [match[1], match[2]]));
  if (new URL(local.API_URL ?? "http://invalid").hostname !== "127.0.0.1") throw new Error("This regression requires local Supabase only.");
  return local;
}

async function waitForApp() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/login`)).ok) return;
    } catch { /* local server is still starting */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error("Local application did not become ready.");
}

async function must(promise) {
  const result = await promise;
  if (result.error) throw new Error("Local role-aware authorization setup failed.");
  return result.data;
}

async function denied(name, promise) {
  const result = await promise;
  assert.ok(result.error || !result.data, name);
  console.log(`PASS: ${name}`);
}

async function signIn(page, email, password) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard", { timeout: 30000 });
}

async function assertClientBoundary(page, email, password, ownName, otherName, roleCode) {
  await signIn(page, email, password);
  const dashboardBody = await page.locator("body").innerText();
  assert.doesNotMatch(dashboardBody, new RegExp(otherName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "cross-tenant organization leaked on dashboard");
  assert.match(dashboardBody, new RegExp(ownName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "own organization context missing");
  for (const path of ["/dashboard", "/client-catalog", "/library"]) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 200, `${roleCode} should access ${path}`);
  }
  const navigation = await page.locator("body").innerText();
  for (const label of ["Administration", "Branding", "Salespeople", "Pricing Tiers", "Client Roles"]) {
    assert.doesNotMatch(navigation, new RegExp(`^${label}$`, "mi"), `unauthorized navigation exposed: ${label}`);
  }
  for (const path of privilegedRoutes) {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    assert.equal(response?.status(), 404, `${roleCode} should be denied ${path}`);
  }
}

const local = localEnvironment();
const service = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const run = randomUUID();
const password = `${randomUUID()}-Aa1!`;
const records = [];
const organizationIds = [];
const stalePermissionIdsByRole = [];
let app;
let browser;

try {
  const provider = await must(service.from("organizations").insert({ name: `P7 role provider ${run}`, slug: `p7-role-provider-${run}`, organization_type: "fulfillment_company", status: "active" }).select("id").single());
  const clientA = await must(service.from("organizations").insert({ name: `P7 role client A ${run}`, slug: `p7-role-client-a-${run}`, organization_type: "client_company", parent_organization_id: provider.id, status: "active" }).select("id").single());
  const clientB = await must(service.from("organizations").insert({ name: `P7 role client B ${run}`, slug: `p7-role-client-b-${run}`, organization_type: "client_company", parent_organization_id: provider.id, status: "active" }).select("id").single());
  organizationIds.push(clientB.id, clientA.id, provider.id);

  const roles = await must(service.from("roles").select("id,code").in("code", ["CLIENT_USER", "CLIENT_ADMIN", "ADMIN"]));
  const roleIds = Object.fromEntries(roles.map((role) => [role.code, role.id]));
  const permissions = await must(service.from("permissions").select("id,code").in("code", clientSideStalePermissions));
  for (const roleCode of ["CLIENT_USER", "CLIENT_ADMIN"]) {
    const roleId = roleIds[roleCode];
    const existingPermissionRows = await must(service.from("role_permissions").select("permission_id").eq("role_id", roleId).in("permission_id", permissions.map((permission) => permission.id)));
    const existingPermissionIds = new Set((existingPermissionRows ?? []).map((row) => row.permission_id));
    const cleanupIds = permissions.filter((permission) => !existingPermissionIds.has(permission.id)).map((permission) => permission.id);
    stalePermissionIdsByRole.push({ roleId, permissionIds: cleanupIds });
    await must(service.from("role_permissions").upsert(permissions.map((permission) => ({ role_id: roleId, permission_id: permission.id }))));
  }

  async function createUser(label) {
    const email = `p7-role-${label}-${run}@example.test`;
    const user = await must(service.auth.admin.createUser({ email, password, email_confirm: true }));
    records.push({ email, userId: user.user.id });
    return records.at(-1);
  }
  const clientUserA = await createUser("client-a");
  const clientUserB = await createUser("client-b");
  const clientAdminA = await createUser("client-admin-a");
  const admin = await createUser("admin");
  await must(service.from("organization_memberships").insert([
    { organization_id: clientA.id, user_id: clientUserA.userId, role_id: roleIds.CLIENT_USER, status: "active", is_primary: true },
    { organization_id: clientB.id, user_id: clientUserB.userId, role_id: roleIds.CLIENT_USER, status: "active", is_primary: true },
    { organization_id: clientA.id, user_id: clientAdminA.userId, role_id: roleIds.CLIENT_ADMIN, status: "active", is_primary: true },
    { organization_id: provider.id, user_id: admin.userId, role_id: roleIds.ADMIN, status: "active", is_primary: true },
  ]));

  app = spawn(process.execPath, [resolve("node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "3107"], {
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: local.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: local.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY },
    stdio: "ignore",
  });
  await waitForApp();
  const clientAdminRpcClient = createClient(local.API_URL, local.ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  await must(clientAdminRpcClient.auth.signInWithPassword({ email: clientAdminA.email, password }));
  await denied("CLIENT_ADMIN cannot call provider administration RPCs", clientAdminRpcClient.rpc("get_phase5b_admin_context", { target_provider_id: clientA.id }));

  browser = await chromium.launch({ headless: true, channel: process.env.PHASE6_BROWSER_CHANNEL || "msedge" });

  for (const [record, ownName, otherName, roleCode] of [[clientUserA, `P7 role client A ${run}`, `P7 role client B ${run}`, "CLIENT_USER"], [clientUserB, `P7 role client B ${run}`, `P7 role client A ${run}`, "CLIENT_USER"], [clientAdminA, `P7 role client A ${run}`, `P7 role client B ${run}`, "CLIENT_ADMIN"]]) {
    const context = await browser.newContext({ baseURL: baseUrl });
    try { await assertClientBoundary(await context.newPage(), record.email, password, ownName, otherName, roleCode); } finally { await context.close(); }
  }

  const clientAdminContext = await browser.newContext({ baseURL: baseUrl });
  try {
    const page = await clientAdminContext.newPage();
    await signIn(page, clientAdminA.email, password);
    assert.equal((await page.goto("/orders", { waitUntil: "domcontentloaded" }))?.status(), 200, "CLIENT_ADMIN should retain client-safe order access");
  } finally { await clientAdminContext.close(); }

  const adminContext = await browser.newContext({ baseURL: baseUrl });
  try {
    const page = await adminContext.newPage();
    await signIn(page, admin.email, password);
    for (const path of privilegedRoutes) assert.equal((await page.goto(path, { waitUntil: "domcontentloaded" }))?.status(), 200, `ADMIN should access ${path}`);
  } finally { await adminContext.close(); }

  console.log("Role-aware privileged authorization and tenant-isolation regressions passed.");
  } finally {
  await browser?.close();
  if (app && !app.killed) app.kill();
  for (const cleanup of stalePermissionIdsByRole) {
    if (cleanup.permissionIds.length) await service.from("role_permissions").delete().eq("role_id", cleanup.roleId).in("permission_id", cleanup.permissionIds);
  }
  for (const record of records) await service.auth.admin.deleteUser(record.userId);
  for (const organizationId of organizationIds) await service.from("organizations").delete().eq("id", organizationId);
}
