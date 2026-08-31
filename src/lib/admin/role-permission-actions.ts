"use server";

import { revalidatePath } from "next/cache";

import { parseUuid } from "@/lib/admin/validation";
import { getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type RolePermissionActionState = { error?: string; success?: string };

export async function setRolePermissionAction(
  _state: RolePermissionActionState,
  formData: FormData,
): Promise<RolePermissionActionState> {
  try {
    const roleId = parseUuid(formData.get("roleId"), "Role");
    const permissionId = parseUuid(formData.get("permissionId"), "Permission");
    const operation = String(formData.get("operation") ?? "");
    if (operation !== "grant" && operation !== "remove") throw new Error("Permission operation is invalid.");

    const context = await getAppContext();
    if (context.membership?.roleCode !== "SUPER_ADMIN") {
      throw new Error("Super-admin authorization required.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_set_role_permission", {
      target_role_id: roleId,
      target_permission_id: permissionId,
      should_grant: operation === "grant",
    });
    if (error) return { error: "Unable to change that role permission." };

    revalidatePath("/administration/roles");
    revalidatePath("/administration/permissions");
    revalidatePath("/administration/audit-log");
    return { success: data ? "Role permissions updated." : "No change was required." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to change that role permission." };
  }
}
