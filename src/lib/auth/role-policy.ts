const clientUserAllowedPermissions = new Set([
  "orders.read",
  "orders.view",
  "orders.create",
  "inventory.read",
  "inventory.view",
  "products.read",
  "products.view",
  "customers.read",
  "customers.view",
  "customer_addresses.view",
  "shipping.read",
  "shipping.view",
  "messages.read",
  "reports.read",
  "billing.view",
  "client_catalog.view",
  "cases.view",
  "cases.acknowledge",
  "replacements.view",
  "returns.view",
  "library.view",
  "library.download",
  "library.print",
]);

const clientAdminAllowedPermissions = new Set([
  ...clientUserAllowedPermissions,
  // Client administrators retain organization-scoped membership capabilities.
  // Provider/platform administration remains outside this client-side allow-list.
  "organizations.read",
  "memberships.read",
  "memberships.manage",
  "roles.read",
  "customers.manage",
  "customers.lifecycle",
  "customers.history",
  "customer_addresses.manage",
]);

const clientSideRoles = new Set(["CLIENT_USER", "CLIENT_ADMIN"]);

const staffProviderWidePermissions = new Set([
  "salespeople.manage",
  "salesperson.assign",
  "commissions.view",
  "commissions.manage",
  "payouts.manage",
  "pricing_tiers.manage",
  "reporting.view",
]);

export function isRolePermissionAllowed(roleCode: string, permission: string) {
  if (roleCode === "CLIENT_USER") return clientUserAllowedPermissions.has(permission);
  if (roleCode === "CLIENT_ADMIN") return clientAdminAllowedPermissions.has(permission);
  if (roleCode === "STAFF") return !staffProviderWidePermissions.has(permission);
  return !clientSideRoles.has(roleCode);
}

export function filterRolePermissions(roleCode: string, permissions: string[]) {
  return permissions.filter((permission) => isRolePermissionAllowed(roleCode, permission));
}
