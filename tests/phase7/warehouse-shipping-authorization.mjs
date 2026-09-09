import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const localUrl = process.env.LOCAL_SUPABASE_URL;
if (!localUrl || new URL(localUrl).hostname !== "127.0.0.1") throw new Error("LOCAL Supabase only");

const supabase = createClient(localUrl, process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const must = async (promise) => {
  const result = await promise;
  if (result.error) throw new Error(JSON.stringify(result.error));
  return result.data;
};
const hasPermission = (assignments, roleId, permissionId) => assignments.some((row) => row.role_id === roleId && row.permission_id === permissionId);

const [roles, permissions, assignments, navigation, shippingPage, migration] = await Promise.all([
  must(supabase.from("roles").select("id,code")),
  must(supabase.from("permissions").select("id,code")),
  must(supabase.from("role_permissions").select("role_id,permission_id")),
  readFile(new URL("../../src/config/navigation.ts", import.meta.url), "utf8"),
  readFile(new URL("../../src/app/(app)/shipping/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../../supabase/migrations/20260914010000_phase7_warehouse_shipping_view.sql", import.meta.url), "utf8"),
]);

const roleId = Object.fromEntries(roles.map((role) => [role.code, role.id]));
const permissionId = Object.fromEntries(permissions.map((permission) => [permission.code, permission.id]));
const requireRole = (code) => assert.ok(roleId[code], `missing role ${code}`);
const requirePermission = (code) => assert.ok(permissionId[code], `missing permission ${code}`);
for (const role of ["WAREHOUSE", "ADMIN", "SUPER_ADMIN", "STAFF", "CLIENT_USER", "CLIENT_ADMIN"]) requireRole(role);
for (const permission of ["shipping.read", "shipping.view", "shipping.manage", "shipping.quote", "shipping.label.create", "shipping.label.void", "shipping.tracking.manage"]) requirePermission(permission);

assert.match(migration, /where r\.code = 'WAREHOUSE'/);
assert.match(migration, /p\.code = 'shipping\.view'/);
assert.match(migration, /on conflict \(role_id, permission_id\) do nothing/);
assert.match(navigation, /label: "Shipping", href: "\/shipping", permission: "shipping\.read"/);
assert.match(shippingPage, /requirePermission\("shipping\.view"\)/);

assert.ok(hasPermission(assignments, roleId.WAREHOUSE, permissionId["shipping.read"]), "WAREHOUSE lost shipping.read");
assert.ok(hasPermission(assignments, roleId.WAREHOUSE, permissionId["shipping.view"]), "WAREHOUSE lacks shipping.view");

const mutationPermissions = ["shipping.manage", "shipping.quote", "shipping.label.create", "shipping.label.void", "shipping.tracking.manage"];
for (const role of ["ADMIN", "SUPER_ADMIN"]) {
  for (const permission of mutationPermissions) assert.ok(hasPermission(assignments, roleId[role], permissionId[permission]), `${role} lost ${permission}`);
}
for (const role of ["WAREHOUSE", "STAFF", "CLIENT_USER", "CLIENT_ADMIN"]) {
  for (const permission of mutationPermissions) assert.equal(hasPermission(assignments, roleId[role], permissionId[permission]), false, `${role} gained ${permission}`);
}

const privacyCodes = permissions.filter((permission) => /^(suppliers\.|product_costs\.|financial_margins\.|purchasing\.view_costs$)/.test(permission.code));
for (const permission of privacyCodes) assert.equal(hasPermission(assignments, roleId.WAREHOUSE, permission.id), false, `WAREHOUSE gained ${permission.code}`);

console.log("Phase 7 WAREHOUSE shipping authorization regression passed.");
