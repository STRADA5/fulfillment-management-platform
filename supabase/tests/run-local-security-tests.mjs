import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const cli = resolve("node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
const status = process.platform === "win32"
  ? execFileSync("cmd.exe", ["/d", "/s", "/c", "node_modules\\.bin\\supabase.cmd status -o env"], { encoding: "utf8" })
  : execFileSync(cli, ["status", "-o", "env"], { encoding: "utf8" });
const local = Object.fromEntries([...status.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map((match) => [match[1], match[2]]));
if (!local.API_URL?.includes("127.0.0.1")) throw new Error("Refusing to test a non-local Supabase URL.");

const environment = {
  ...process.env,
  LOCAL_SUPABASE_URL: local.API_URL,
  LOCAL_SUPABASE_ANON_KEY: local.ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY,
};
const suites = ["tenant-isolation.mjs", "phase2a-membership-administration.mjs", "phase2b-administration.mjs", "phase3a-catalog-suppliers.mjs", "cleanup-phase3a-fixtures.mjs", "phase3a-edit-security.mjs", "cleanup-phase3a-fixtures.mjs", "cleanup-phase3b-fixtures.mjs", "phase3b-inventory-integrity.mjs", "cleanup-phase3b-fixtures.mjs", "cleanup-phase3c-fixtures.mjs", "phase3c-procurement-quality.mjs", "cleanup-phase3c-fixtures.mjs"];
// Clean disposable custom test roles before fixed-role Phase 1/2 assertions.
suites.push("phase3d-client-catalog.mjs");
suites.push("phase3e-customers.mjs");
suites.push("phase4a-orders.mjs");
suites.push("phase4b-order-allocation.mjs");
suites.push("phase4c-fulfillment.mjs");
suites.push("phase4d-shipping.mjs");
suites.push("phase4e-order-amendments.mjs");
suites.push("phase4f-notifications.mjs");
suites.push("phase4g-replacements-returns.mjs");
suites.push("phase5a-billing-financial.mjs");
suites.push("phase5b-salesperson-commission.mjs");
suites.push("phase5c-multi-role-client-relationships.mjs");
suites.push("phase5d-knowledge-library-tools.mjs");
if(!process.argv.includes("--keep-phase3c"))suites.unshift("cleanup-phase3c-fixtures.mjs");
for (const suite of suites) {
  if(process.argv.includes("--phase3e")&&!suite.includes("phase3e"))continue;
  if(process.argv.includes("--phase4a")&&!suite.includes("phase4a"))continue;
  if(process.argv.includes("--phase4b")&&!suite.includes("phase4b"))continue;
  if(process.argv.includes("--phase4c")&&!suite.includes("phase4c"))continue;
  if(process.argv.includes("--phase4d")&&!suite.includes("phase4d"))continue;
  if(process.argv.includes("--phase4e")&&!suite.includes("phase4e"))continue;
  if(process.argv.includes("--phase4f")&&!suite.includes("phase4f"))continue;
  if(process.argv.includes("--phase4g")&&!suite.includes("phase4g"))continue;
  if(process.argv.includes("--phase5a")&&!suite.includes("phase5a"))continue;
  if(process.argv.includes("--phase5b")&&!suite.includes("phase5b"))continue;
  if(process.argv.includes("--phase5c")&&!suite.includes("phase5c"))continue;
  if(process.argv.includes("--phase5d")&&!suite.includes("phase5d"))continue;
  if(process.argv.includes("--phase3d")&&!suite.includes("phase3d"))continue;
  if(process.argv.includes("--phase3c")&&!suite.includes("phase3c"))continue;
  if(process.argv.includes("--keep-phase3c")&&suite==="cleanup-phase3c-fixtures.mjs")continue;
  environment.LOCAL_KEEP_PHASE3C_FIXTURES=process.argv.includes("--keep-phase3c")?"1":"";
  environment.LOCAL_KEEP_PHASE3D_FIXTURES=process.argv.includes("--keep-phase3d")?"1":"";
  environment.LOCAL_KEEP_PHASE3E_FIXTURES=process.argv.includes("--keep-phase3e")?"1":"";
  environment.LOCAL_KEEP_PHASE4A_FIXTURES=process.argv.includes("--keep-phase4a")?"1":"";
  environment.LOCAL_KEEP_PHASE4B_FIXTURES=process.argv.includes("--keep-phase4b")?"1":"";
  console.log(`\nRunning ${suite}`);
  const result = spawnSync(process.execPath, [resolve("supabase", "tests", suite)], { env: environment, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log("\nAll local security regression suites passed.");
