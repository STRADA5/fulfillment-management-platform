import { cache } from "react";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AppContext = {
  user: { id: string; email: string };
  profile: { displayName: string };
  membership: null | {
    id: string;
    organizationId: string;
    organizationName: string;
    roleCode: string;
    permissions: string[];
  };
  memberships: Array<{
    id: string;
    organizationId: string;
    organizationName: string;
    roleCode: string;
    isPrimary: boolean;
  }>;
};

type MembershipRow = {
  id: string;
  organization_id: string;
  is_primary: boolean;
  organizations: { name: string } | null;
  roles: { code: string; role_permissions: Array<{ permissions: { code: string } | null }> } | null;
};

export const getAppContext = cache(async (): Promise<AppContext> => {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: profile }, { data: membershipData }] = await Promise.all([
    supabase.from("profiles").select("display_name, first_name, last_name").eq("id", user.id).maybeSingle(),
    supabase
      .from("organization_memberships")
      .select("id, organization_id, is_primary, organizations(name), roles(code, role_permissions(permissions(code)))")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: true }),
  ]);

  const membershipRows = (membershipData ?? []) as unknown as MembershipRow[];
  const membership = membershipRows[0] ?? null;
  const nameParts = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: { displayName: profile?.display_name || nameParts || user.email || "User" },
    membership: membership?.organizations && membership.roles ? {
      id: membership.id,
      organizationId: membership.organization_id,
      organizationName: membership.organizations.name,
      roleCode: membership.roles.code,
      permissions: membership.roles.role_permissions
        .map((entry) => entry.permissions?.code)
        .filter((code): code is string => Boolean(code)),
    } : null,
    memberships: membershipRows.flatMap((row) => row.organizations && row.roles ? [{
      id: row.id,
      organizationId: row.organization_id,
      organizationName: row.organizations.name,
      roleCode: row.roles.code,
      isPrimary: row.is_primary,
    }] : []),
  };
});

export function can(context: AppContext, permission: string) {
  return context.membership?.permissions.includes(permission) ?? false;
}

export async function requirePermission(permission: string) {
  const context = await getAppContext();
  if (!can(context, permission)) notFound();
  return context;
}
