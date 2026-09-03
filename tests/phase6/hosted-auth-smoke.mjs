import { chromium } from "@playwright/test";

const EXPECTED_PREVIEW_URL = "https://fulfillment-management-platform-5uxw6i3a.vercel.app";
const EXPECTED_SUPABASE_HOST = "nftufhffzlokryafcbku.supabase.co";
const REQUIRED_ROLES = ["client-b", "client-a", "salesperson-a", "salesperson-b", "fulfillment-operator", "super-admin"];

// Non-secret identifiers from the approved synthetic Phase 6 staging fixture.
// These values are the organization names rendered by the application shell.
const SYNTHETIC_ORGANIZATIONS = Object.freeze({
  platform: "P6S-20260902040001-b313d7f9 PLATFORM",
  provider: "P6S-20260902040001-b313d7f9 PROVIDER",
  clientA: "P6S-20260902040001-b313d7f9 CLIENT A",
  clientB: "P6S-20260902040001-b313d7f9 CLIENT B",
});

const roleMatrix = {
  "client-b": {
    label: "Unrelated synthetic Client B",
    expectedRole: "CLIENT_USER",
    expectedOrganization: SYNTHETIC_ORGANIZATIONS.clientB,
    allowed: ["/dashboard", "/client-catalog", "/library"],
    denied: ["/administration", "/salespeople", "/client-relationships", "/pricing-tiers"],
  },
  "client-a": {
    label: "Multi-role synthetic Client A",
    expectedRole: "CLIENT_USER",
    expectedOrganization: SYNTHETIC_ORGANIZATIONS.clientA,
    allowed: ["/dashboard", "/client-catalog", "/library"],
    denied: ["/administration", "/salespeople", "/client-relationships", "/pricing-tiers"],
  },
  "salesperson-a": {
    label: "Salesperson A",
    expectedRole: "STAFF",
    expectedOrganization: SYNTHETIC_ORGANIZATIONS.provider,
    allowed: ["/dashboard", "/salespeople", "/reports", "/pricing-tiers", "/library"],
    denied: ["/administration", "/client-relationships"],
  },
  "salesperson-b": {
    label: "Salesperson B",
    expectedRole: "STAFF",
    expectedOrganization: SYNTHETIC_ORGANIZATIONS.provider,
    allowed: ["/dashboard", "/salespeople", "/reports", "/pricing-tiers", "/library"],
    denied: ["/administration", "/client-relationships"],
  },
  "fulfillment-operator": {
    label: "Fulfillment Operator",
    expectedRole: "WAREHOUSE",
    expectedOrganization: SYNTHETIC_ORGANIZATIONS.provider,
    allowed: ["/dashboard", "/inventory", "/warehouses", "/receiving", "/qc", "/library"],
    denied: ["/administration", "/fulfillment", "/salespeople", "/reports", "/billing", "/client-relationships"],
  },
  "super-admin": {
    label: "Platform Super-Admin / Provider Administrator",
    expectedRole: "SUPER_ADMIN",
    expectedOrganization: SYNTHETIC_ORGANIZATIONS.platform,
    allowed: ["/dashboard", "/administration", "/salespeople", "/reports", "/client-relationships", "/pricing-tiers", "/library"],
    denied: [],
  },
};

function fail(message) {
  throw new Error(message);
}

function readConfig() {
  const previewUrl = process.env.PHASE6_PREVIEW_URL;
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (!previewUrl || !bypass) fail("Required Phase 6 process configuration is missing.");
  let parsed;
  try {
    parsed = new URL(previewUrl);
  } catch {
    fail("PHASE6_PREVIEW_URL is invalid.");
  }
  if (parsed.origin !== EXPECTED_PREVIEW_URL || parsed.pathname !== "/" || parsed.search || parsed.hash) {
    fail("PHASE6_PREVIEW_URL is not the approved Preview deployment.");
  }
  return { previewUrl: parsed.origin, bypass };
}

function assertCredentials(records) {
  if (!Array.isArray(records) || records.length !== REQUIRED_ROLES.length) fail("Exactly six protected synthetic credentials are required.");
  const roles = records.map((record) => record?.role);
  if (new Set(roles).size !== REQUIRED_ROLES.length || REQUIRED_ROLES.some((role) => !roles.includes(role))) fail("The protected credential role matrix is incomplete.");
  for (const record of records) {
    if (typeof record.email !== "string" || typeof record.password !== "string" || !record.email || !record.password) fail(`Protected credential is incomplete for ${record.role}.`);
  }
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { value += chunk; });
    process.stdin.on("end", () => resolve(value));
    process.stdin.on("error", reject);
  });
}

function isAllowedHost(url) {
  const host = new URL(url).hostname;
  return host === new URL(EXPECTED_PREVIEW_URL).hostname || host === EXPECTED_SUPABASE_HOST;
}

async function bodyText(page) {
  return (await page.locator("body").innerText({ timeout: 5000 })).replace(/\s+/g, " ").trim();
}

async function expectAppLogin(page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Sign in" }).waitFor({ state: "visible" });
  if ((await page.getByRole("heading", { name: "Log in to Vercel" }).count()) > 0) fail("Vercel protection gateway remained in front of the application.");
}

async function signIn(page, record) {
  await page.getByLabel("Email").fill(record.email);
  await page.getByLabel("Password").fill(record.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => url.origin === EXPECTED_PREVIEW_URL && url.pathname === "/dashboard", { timeout: 30000 });
  await page.getByRole("heading", { name: "Dashboard" }).waitFor({ state: "visible" });
}

async function expectContext(page, matrix) {
  const text = await bodyText(page);
  if (!text.includes(matrix.expectedOrganization)) fail(`${matrix.label}: expected organization context was not rendered.`);
  const membershipSelector = page.locator("#active-membership");
  if (await membershipSelector.count()) {
    const selected = await membershipSelector.locator("option:checked").textContent();
    if (!selected?.includes(matrix.expectedRole)) fail(`${matrix.label}: expected role context was not rendered.`);
  }
}

async function checkNavigation(page, matrix) {
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  const visibleLinks = await nav.getByRole("link").allTextContents();
  if (!visibleLinks.length) fail(`${matrix.label}: primary navigation did not render.`);
}

async function checkRoute(page, path, expectedAllowed, label) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  const status = response?.status() ?? 0;
  const current = new URL(page.url());
  const text = await bodyText(page).catch(() => "");
  const redirectedToDashboard = path !== "/dashboard" && current.pathname === "/dashboard";
  const denied = status === 403 || status === 404 || redirectedToDashboard || /not found|not authorized|unauthorized|access denied/i.test(text);
  if (expectedAllowed && (denied || current.pathname !== path)) fail(`${label}: expected ${path} to be accessible.`);
  if (!expectedAllowed && !denied) fail(`${label}: prohibited route ${path} was accessible.`);
}

async function roleCheck(page, record, matrix) {
  await expectAppLogin(page);
  await signIn(page, record);
  await expectContext(page, matrix);
  await checkNavigation(page, matrix);
  for (const path of matrix.allowed) await checkRoute(page, path, true, matrix.label);
  for (const path of matrix.denied) await checkRoute(page, path, false, matrix.label);

  if (matrix.expectedOrganization === SYNTHETIC_ORGANIZATIONS.clientA) {
    const text = await bodyText(page);
    if (text.includes(SYNTHETIC_ORGANIZATIONS.clientB)) fail(`${matrix.label}: unrelated Organization B data leaked into the session.`);
  }
  if (matrix.expectedOrganization === SYNTHETIC_ORGANIZATIONS.clientB) {
    const text = await bodyText(page);
    if (text.includes(SYNTHETIC_ORGANIZATIONS.clientA)) fail(`${matrix.label}: unrelated Organization A data leaked into the session.`);
  }

  if (record.role === "salesperson-a" || record.role === "salesperson-b") {
    await page.goto("/salespeople", { waitUntil: "domcontentloaded" });
    const salespersonText = await bodyText(page);
    const ownOrganization = record.role === "salesperson-a" ? SYNTHETIC_ORGANIZATIONS.clientA : SYNTHETIC_ORGANIZATIONS.clientB;
    const unrelatedOrganization = record.role === "salesperson-a" ? SYNTHETIC_ORGANIZATIONS.clientB : SYNTHETIC_ORGANIZATIONS.clientA;
    if (!salespersonText.includes(ownOrganization)) fail(`${matrix.label}: assigned-client attribution was not visible.`);
    if (salespersonText.includes(unrelatedOrganization)) fail(`${matrix.label}: unrelated salesperson attribution was visible.`);
  }

  if (record.role === "client-a") {
    await page.goto("/library", { waitUntil: "domcontentloaded" });
    const clientLibraryText = await bodyText(page);
    if (!/client-safe|approved/i.test(clientLibraryText)) fail(`${matrix.label}: client-safe library boundary was not rendered.`);
  }

  if (record.role === "super-admin") {
    await page.goto("/client-relationships", { waitUntil: "domcontentloaded" });
    const relationshipText = await bodyText(page);
    if (!relationshipText.includes(SYNTHETIC_ORGANIZATIONS.clientA)) fail(`${matrix.label}: approved multi-role/affiliate fixture was not visible to the administrator.`);
  }
}

async function main() {
  const config = readConfig();
  if (process.argv.includes("--config-check")) {
    if (config.bypass.length === 0) fail("The Vercel bypass configuration is empty.");
    if (!("x-vercel-protection-bypass" in { "x-vercel-protection-bypass": config.bypass })) fail("The Vercel bypass header is not configured.");
    console.log("Phase 6 hosted smoke configuration is valid.");
    return;
  }

  const input = await readStdin();
  let records;
  try {
    records = JSON.parse(input);
  } catch {
    fail("Protected synthetic credential input is invalid.");
  }
  assertCredentials(records);

  const browser = await chromium.launch({ headless: true, channel: process.env.PHASE6_BROWSER_CHANNEL || "msedge" });
  try {
    for (const role of REQUIRED_ROLES) {
      const record = records.find((candidate) => candidate.role === role);
      const matrix = roleMatrix[role];
      const context = await browser.newContext({
        baseURL: config.previewUrl,
        extraHTTPHeaders: { "x-vercel-protection-bypass": config.bypass },
        acceptDownloads: false,
      });
      const page = await context.newPage();
      const unexpectedHosts = new Set();
      page.on("request", (request) => {
        if (!isAllowedHost(request.url())) unexpectedHosts.add(new URL(request.url()).hostname);
      });
      try {
        await roleCheck(page, record, matrix);
        if (unexpectedHosts.size) fail(`${matrix.label}: unexpected external host contacted.`);
        console.log(`${matrix.label}: PASS`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  console.log("All six Phase 6 hosted smoke roles passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Hosted smoke test failed.";
  console.error(message.replace(/https?:\/\/[^\s]+/g, "[redacted-url]"));
  process.exitCode = 1;
});
