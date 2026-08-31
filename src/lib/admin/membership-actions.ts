"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { getAppContext, requirePermission } from "@/lib/auth/authorization";
import {
  parseEmail,
  parseMembershipStatus,
  parseOptionalName,
  parseProfileStatus,
  parseUuid,
} from "@/lib/admin/validation";
import { getPermittedRoleCodes } from "@/lib/admin/role-policy";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type AdminActionState = { error?: string; success?: string };

async function requireCurrentOrganization(organizationId: string) {
  const context = await requirePermission("memberships.manage");
  if (!context.membership || context.membership.organizationId !== organizationId) {
    throw new Error("The selected organization is not active in this session.");
  }
  return context;
}

async function validateAssignableRole(roleId: string, actorRoleCode: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("roles").select("code").eq("id", roleId).maybeSingle();
  if (error || !data || !getPermittedRoleCodes(actorRoleCode).includes(data.code)) {
    throw new Error("You are not authorized to assign that role.");
  }
}

async function findAuthUserByEmail(email: string) {
  const admin = createAdminClient();
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Unable to inspect existing accounts.");
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return { user: match, created: false };
    if (data.users.length < 1000) break;
  }
  return null;
}

async function deleteUnattachedCreatedUser(userId: string) {
  const admin = createAdminClient();
  const { count } = await admin
    .from("organization_memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (count === 0) await admin.auth.admin.deleteUser(userId);
}

export async function inviteMemberAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  let createdUserId: string | null = null;
  try {
    const organizationId = parseUuid(formData.get("organizationId"), "Organization");
    const roleId = parseUuid(formData.get("roleId"), "Role");
    const email = parseEmail(formData.get("email"));
    const firstName = parseOptionalName(formData.get("firstName"), "First name");
    const lastName = parseOptionalName(formData.get("lastName"), "Last name");
    const context = await requireCurrentOrganization(organizationId);
    await validateAssignableRole(roleId, context.membership!.roleCode);

    const admin = createAdminClient();
    let existing = await findAuthUserByEmail(email);
    if (!existing) {
      const requestHeaders = await headers();
      const origin = requestHeaders.get("origin");
      if (!origin) throw new Error("Unable to determine the application URL.");
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { first_name: firstName || null, last_name: lastName || null, display_name: [firstName, lastName].filter(Boolean).join(" ") || null },
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });
      if (error || !data.user) throw new Error("Unable to create the invitation.");
      createdUserId = data.user.id;
      existing = { user: data.user, created: true };
    }

    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_invite_organization_member", {
      target_organization_id: organizationId,
      target_user_id: existing.user.id,
      target_role_id: roleId,
    });
    if (error) {
      if (createdUserId) await deleteUnattachedCreatedUser(createdUserId);
      return { error: "Unable to create that organization invitation." };
    }

    revalidatePath("/administration/users");
    return { success: existing.created ? "Invitation sent and membership created." : "Pending membership created for the existing account." };
  } catch (error) {
    if (createdUserId) await deleteUnattachedCreatedUser(createdUserId);
    return { error: error instanceof Error ? error.message : "Unable to create the invitation." };
  }
}

export async function updateMembershipAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const organizationId = parseUuid(formData.get("organizationId"), "Organization");
    const membershipId = parseUuid(formData.get("membershipId"), "Membership");
    const roleId = parseUuid(formData.get("roleId"), "Role");
    const status = parseMembershipStatus(formData.get("status"));
    const context = await requireCurrentOrganization(organizationId);
    await validateAssignableRole(roleId, context.membership!.roleCode);

    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_update_organization_membership", {
      target_membership_id: membershipId,
      target_role_id: roleId,
      target_status: status,
    });
    if (error) return { error: "Unable to update that membership." };
    revalidatePath("/administration/users");
    return { success: "Membership updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update that membership." };
  }
}

export async function removeMembershipAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const organizationId = parseUuid(formData.get("organizationId"), "Organization");
    const membershipId = parseUuid(formData.get("membershipId"), "Membership");
    await requireCurrentOrganization(organizationId);
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_remove_organization_membership", { target_membership_id: membershipId });
    if (error) return { error: "Unable to remove that membership." };
    revalidatePath("/administration/users");
    return { success: "Membership removed." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to remove that membership." };
  }
}

export async function setProfileStatusAction(
  _state: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  try {
    const targetUserId = parseUuid(formData.get("userId"), "User");
    const status = parseProfileStatus(formData.get("status"));
    const context = await getAppContext();
    if (context.membership?.roleCode !== "SUPER_ADMIN") throw new Error("Super-admin authorization required.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("admin_set_profile_status", { target_user_id: targetUserId, target_status: status });
    if (error) return { error: "Unable to update that profile status." };
    revalidatePath("/administration/users");
    return { success: "Profile status updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to update that profile status." };
  }
}

export async function setPrimaryOrganizationAction(formData: FormData) {
  const membershipId = parseUuid(formData.get("membershipId"), "Membership");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_my_primary_organization", { target_membership_id: membershipId });
  if (error) throw new Error("Unable to change the active organization.");
  revalidatePath("/", "layout");
}
