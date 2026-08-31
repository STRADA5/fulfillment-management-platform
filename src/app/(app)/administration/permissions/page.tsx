import { PageHeading } from "@/components/ui/page-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

type PermissionRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  role_permissions: Array<{ roles: { name: string; code: string } | null }>;
};

export default async function PermissionsPage() {
  await requirePermission("roles.read");
  const supabase = await createClient();
  const { data } = await supabase
    .from("permissions")
    .select("id, code, name, description, role_permissions(roles(name, code))")
    .order("code");
  const permissions = (data ?? []) as unknown as PermissionRow[];

  return (
    <>
      <PageHeading title="Permissions" description="Review global permission definitions and the system roles that currently receive them." />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {permissions.map((permission) => (
          <article key={permission.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-950">{permission.name}</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">{permission.code}</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">{permission.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {permission.role_permissions.length ? permission.role_permissions.map((entry) => entry.roles ? (
                <span key={entry.roles.code} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{entry.roles.name}</span>
              ) : null) : <span className="text-xs text-slate-500">Not assigned to any role</span>}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
