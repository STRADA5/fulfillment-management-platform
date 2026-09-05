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

export function isRolePermissionAllowed(roleCode: string, permission: string) {
  return roleCode !== "CLIENT_USER" || clientUserAllowedPermissions.has(permission);
}

export function filterRolePermissions(roleCode: string, permissions: string[]) {
  return permissions.filter((permission) => isRolePermissionAllowed(roleCode, permission));
}
