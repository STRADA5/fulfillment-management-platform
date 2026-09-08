import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  navigation: await readFile("src/config/navigation.ts", "utf8"),
  clientsPage: await readFile("src/app/(app)/clients/page.tsx", "utf8"),
  salespeoplePage: await readFile("src/app/(app)/salespeople/page.tsx", "utf8"),
  reportsPage: await readFile("src/app/(app)/reports/page.tsx", "utf8"),
  rolePolicy: await readFile("src/lib/auth/role-policy.ts", "utf8"),
  migration: await readFile("supabase/migrations/20260913010000_phase7_staff_salesperson_assigned_scope.sql", "utf8"),
};

assert.match(files.navigation, /\{ label: "Reports", href: "\/reports", permission: "salesperson\.dashboard" \}/);
assert.match(files.clientsPage, /roleCode === "STAFF"/);
assert.match(files.clientsPage, /get_salesperson_dashboard/);
assert.match(files.clientsPage, /assigned_clients/);
assert.match(files.salespeoplePage, /const providerAdmin = can\(context, "salespeople\.manage"\) \|\| can\(context, "commissions\.view"\) \|\| can\(context, "pricing_tiers\.manage"\)/);
assert.match(files.salespeoplePage, /providerAdmin && admin/);
assert.match(files.salespeoplePage, /Payout history/);
assert.match(files.reportsPage, /get_salesperson_dashboard/);
assert.match(files.reportsPage, /get_salesperson_report/);
for (const permission of ["salespeople.manage", "salesperson.assign", "commissions.view", "commissions.manage", "payouts.manage", "pricing_tiers.manage", "reporting.view"]) {
  assert.match(files.rolePolicy, new RegExp(`"${permission.replaceAll(".", "\\.")}"`));
  assert.match(files.migration, new RegExp(`'${permission.replaceAll(".", "\\.")}'`));
}
assert.match(files.migration, /s\.id=own_salesperson_id/);
assert.match(files.migration, /a\.salesperson_id=own_salesperson_id/);
assert.match(files.migration, /provider_admin/);

console.log("Phase 7 salesperson scope policy checks passed.");
