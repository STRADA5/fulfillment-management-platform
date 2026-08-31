import "server-only";

import type { MembershipItem } from "@/components/admin/membership-administration";
import { getPermittedRoleCodes } from "@/lib/admin/role-policy";
import { getAppContext, requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

type MembershipRow = {
  id: string;
  user_id: string;
  role_id: string;
  status: MembershipItem["status"];
  is_primary: boolean;
  roles: { name: string } | null;
};

export async function loadMembershipPageData() {
  await requirePermission("memberships.read");
  const context = await getAppContext();
  if (!context.membership) return null;
  const supabase = await createClient();
  const [{ data: membershipData }, { data: roleData }] = await Promise.all([
    supabase.from("organization_memberships").select("id, user_id, role_id, status, is_primary, roles(name)")
      .eq("organization_id", context.membership.organizationId).order("created_at"),
    supabase.from("roles").select("id, code, name").order("name"),
  ]);
  const membershipRows = (membershipData ?? []) as unknown as MembershipRow[];
  const userIds = membershipRows.map((row) => row.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, display_name, first_name, last_name, status").in("id", userIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const allowedCodes = getPermittedRoleCodes(context.membership.roleCode);
  const roles = (roleData ?? []).filter((role) => allowedCodes.includes(role.code));
  const memberships: MembershipItem[] = membershipRows.map((row) => {
    const profile = profileMap.get(row.user_id);
    const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
    return {
      id: row.id,
      userId: row.user_id,
      displayName: profile?.display_name || fullName || "Unnamed user",
      profileStatus: profile?.status ?? "inactive",
      roleId: row.role_id,
      roleName: row.roles?.name ?? "Unknown role",
      status: row.status,
      isPrimary: row.is_primary,
      isSelf: row.user_id === context.user.id,
    };
  });
  return {
    organizationId: context.membership.organizationId,
    organizationName: context.membership.organizationName,
    roles,
    memberships,
    canManageProfiles: context.membership.roleCode === "SUPER_ADMIN",
  };
}
