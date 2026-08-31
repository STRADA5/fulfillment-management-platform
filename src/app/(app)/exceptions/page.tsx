import { PageHeading } from "@/components/ui/page-heading";
import { CaseAcknowledgmentForm } from "@/components/exceptions/case-acknowledgment-form";
import { getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function ExceptionsPage() {
  const context = await getAppContext();
  const supabase = await createClient();
  const canManage = context.membership?.permissions.includes("discrepancies.manage") ?? false;
  const { data } = canManage ? await supabase.from("discrepancy_cases").select("id,case_number,case_type,severity,status,title,description,created_at").order("created_at", { ascending: false }) : { data: await supabase.rpc("get_client_case_feed", { target_limit: 50 }).then((r) => r.data) };
  const rows = Array.isArray(data) ? data as Array<{ id?: string; case_number?: string; case_type?: string; severity?: string; status?: string; title?: string; description?: string; created_at?: string }> : [];
  return <><PageHeading title="Exceptions & returns" description="Discrepancy status, recipient acknowledgments, replacement and return workflows remain tenant-scoped and audited."/><div className="mt-6 space-y-3">{rows.length ? rows.map((row, index) => <article key={row.id ?? `${row.case_number}-${index}`} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-slate-900">{row.title ?? row.case_number ?? "Case"}</h2><span className="text-xs uppercase tracking-wide text-slate-500">{row.status} · {row.severity}</span></div><p className="mt-2 text-sm text-slate-600">{row.description ?? row.case_type}</p>{!canManage && row.id ? <CaseAcknowledgmentForm caseId={row.id}/> : null}</article>) : <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No discrepancy cases are visible for this organization.</p>}</div></>;
}
