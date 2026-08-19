import type { ReactNode } from "react";

import { requirePermission } from "@/lib/auth/authorization";

export default async function AdministrationLayout({ children }: { children: ReactNode }) {
  await requirePermission("administration.access");
  return children;
}
