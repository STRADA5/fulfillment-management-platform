import { RolePermissionAdministration, type PermissionDefinition, type RoleDefinition } from "@/components/admin/role-permission-administration";
import { PageHeading } from "@/components/ui/page-heading";
import { getAppContext, requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  role_permissions: Array<{ permission_id: string }>;
};

export default async function RolesPage() {
  await requirePermission("roles.read");
  const context = await getAppContext();
  const supabase = await createClient();
  const [{ data: roleData }, { data: permissionData }] = await Promise.all([
    supabase.from("roles").select("id, code, name, description, role_permissions(permission_id)").order("name"),
    supabase.from("permissions").select("id, code, name, description").order("code"),
  ]);
  const roles: RoleDefinition[] = ((roleData ?? []) as unknown as RoleRow[]).map((role) => ({
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    permissionIds: role.role_permissions.map((entry) => entry.permission_id),
  }));
  const permissions = (permissionData ?? []) as PermissionDefinition[];

  return (
    <>
      <PageHeading title="Roles" description="Review global system roles and their assigned permissions. Changes affect every organization." />
      <RolePermissionAdministration roles={roles} permissions={permissions} canEdit={context.membership?.roleCode === "SUPER_ADMIN"} />
    </>
  );
}
