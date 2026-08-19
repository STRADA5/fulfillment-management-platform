export type NavigationItem = { label: string; href: string; permission?: string };

export const primaryNavigation: NavigationItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Orders", href: "/orders", permission: "orders.read" },
  { label: "Inventory", href: "/inventory", permission: "inventory.read" },
  { label: "Products", href: "/products", permission: "products.read" },
  { label: "Clients", href: "/clients", permission: "clients.read" },
  { label: "Customers", href: "/customers", permission: "customers.read" },
  { label: "Shipping", href: "/shipping", permission: "shipping.read" },
  { label: "Receiving", href: "/receiving", permission: "receiving.read" },
  { label: "QC / Replacements", href: "/qc", permission: "qc.read" },
  { label: "Branding", href: "/branding", permission: "branding.read" },
  { label: "Messages", href: "/messages", permission: "messages.read" },
  { label: "Reports", href: "/reports", permission: "reports.read" },
  { label: "Administration", href: "/administration", permission: "administration.access" },
];

export const administrationNavigation: NavigationItem[] = [
  { label: "Organizations", href: "/administration/organizations", permission: "organizations.read" },
  { label: "Users", href: "/administration/users", permission: "memberships.read" },
  { label: "Roles & Permissions", href: "/administration/roles", permission: "roles.read" },
  { label: "System Settings", href: "/administration/settings", permission: "settings.manage" },
  { label: "Audit Log", href: "/administration/audit-log", permission: "audit.read" },
];
