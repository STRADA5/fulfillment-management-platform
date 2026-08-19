import { cache } from "react";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type AppContext = {
  user: { id: string; email: string };
  profile: { displayName: string };
  membership: null | {
    organizationId: string;
    organizationName: string;
    roleCode: string;
    permissions: string[];
  };
};

type MembershipRow = {
  organization_id: string;
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
      .select("organization_id, organizations(name), roles(code, role_permissions(permissions(code)))")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("is_primary", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const membership = membershipData as unknown as MembershipRow | null;
  const nameParts = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");

  return {
    user: { id: user.id, email: user.email ?? "" },
    profile: { displayName: profile?.display_name || nameParts || user.email || "User" },
    membership: membership?.organizations && membership.roles ? {
      organizationId: membership.organization_id,
      organizationName: membership.organizations.name,
      roleCode: membership.roles.code,
      permissions: membership.roles.role_permissions
        .map((entry) => entry.permissions?.code)
        .filter((code): code is string => Boolean(code)),
    } : null,
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
