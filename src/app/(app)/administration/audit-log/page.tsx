import { PageHeading } from "@/components/ui/page-heading";
import { getAppContext, requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

type AuditRow = {
  id: number;
  actor_user_id: string | null;
  organization_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
  organizations: { name: string } | null;
};

export default async function AuditLogPage() {
  await requirePermission("audit.read");
  const context = await getAppContext();
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_logs")
    .select("id, actor_user_id, organization_id, action, entity_type, entity_id, metadata, created_at, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  const events = (data ?? []) as unknown as AuditRow[];
  const actorIds = [...new Set(events.flatMap((event) => event.actor_user_id ? [event.actor_user_id] : []))];
  const { data: profiles } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name, first_name, last_name").in("id", actorIds)
    : { data: [] };
  const actorMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

  return (
    <>
      <PageHeading title="Audit Log" description={`Trusted administrative events visible from ${context.membership?.organizationName ?? "the current organization context"}.`} />
      <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {events.length ? <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Actor</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Resource</th><th className="px-4 py-3">Organization</th><th className="px-4 py-3">Metadata</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => {
                const actor = event.actor_user_id ? actorMap.get(event.actor_user_id) : null;
                const actorName = actor?.display_name || [actor?.first_name, actor?.last_name].filter(Boolean).join(" ") || event.actor_user_id || "System";
                return (
                  <tr key={event.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600"><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></td>
                    <td className="max-w-48 break-all px-4 py-3 text-slate-700">{actorName}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">{event.action}</td>
                    <td className="px-4 py-3 text-slate-600"><span className="block">{event.entity_type}</span><span className="font-mono text-xs">{event.entity_id ?? "—"}</span></td>
                    <td className="px-4 py-3 text-slate-600">{event.organizations?.name ?? event.organization_id ?? "Platform"}</td>
                    <td className="max-w-sm px-4 py-3"><pre className="whitespace-pre-wrap break-words text-xs text-slate-600">{JSON.stringify(event.metadata, null, 2)}</pre></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div> : <p className="p-8 text-center text-sm text-slate-500">No audit events are visible in this organization context.</p>}
      </div>
      <p className="mt-3 text-xs text-slate-500">Showing the 100 most recent events. Audit records are append-only and cannot be edited here.</p>
    </>
  );
}
