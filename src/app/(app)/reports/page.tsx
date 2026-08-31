import { getAppContext, can } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/page-heading";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const context = await getAppContext();
  if (!context.membership || (!can(context, "reporting.view") && !can(context, "salesperson.dashboard"))) return null;
  const params = await searchParams;
  const now = new Date();
  const year = Number(params.year ?? now.getUTCFullYear());
  const month = Math.min(12, Math.max(1, Number(params.month ?? now.getUTCMonth() + 1)));
  const annual = params.period === "year";
  const start = new Date(Date.UTC(year, annual ? 0 : month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(annual ? year + 1 : year, annual ? 0 : month, 1)).toISOString();
  const supabase = await createClient();
  const organization = context.membership.organizationId;
  const { data: rawClients } = can(context, "reporting.view") ? await supabase.from("organizations").select("id,name").eq("organization_type", "client_company").eq("parent_organization_id", organization).order("name") : { data: [] };
  const clients = (rawClients ?? []) as Array<{ id: string; name: string }>;
  const requestedScope = params.scope === "client" ? "client" : params.scope === "salesperson" ? "salesperson" : "company";
  const scope = can(context, "reporting.view") ? requestedScope : "salesperson";
  let report: Record<string, unknown> | null = null;
  if (scope === "company") {
    const { data } = await supabase.rpc("get_company_sales_report", { target_provider_id: organization, target_start: start, target_end: end });
    report = data as Record<string, unknown> | null;
  } else if (scope === "client") {
    const clientId = params.client ?? clients[0]?.id;
    if (clientId) { const { data } = await supabase.rpc("get_client_sales_report", { target_provider_id: organization, target_client_id: clientId, target_start: start, target_end: end }); report = data as Record<string, unknown> | null; }
  } else {
    const { data: dashboard } = await supabase.rpc("get_salesperson_dashboard", { target_provider_id: organization });
    const salespersonId = (dashboard as { salesperson?: { id: string } } | null)?.salesperson?.id;
    if (salespersonId) { const { data } = await supabase.rpc("get_salesperson_report", { target_provider_id: organization, target_salesperson_id: salespersonId, target_start: start, target_end: end }); report = data as Record<string, unknown> | null; }
  }
  return <><PageHeading title="Sales reporting" description="Monthly and yearly reporting for authorized providers and assigned salespeople." /><form className="mt-6 flex flex-wrap gap-3"><label className="text-sm">Period<select name="period" defaultValue={annual ? "year" : "month"} className="ml-2 rounded border p-2"><option value="month">Month</option><option value="year">Year</option></select></label><label className="text-sm">Year<input name="year" type="number" defaultValue={year} className="ml-2 rounded border p-2" /></label><label className="text-sm">Month<input name="month" type="number" min="1" max="12" defaultValue={month} className="ml-2 rounded border p-2" /></label>{can(context, "reporting.view") ? <label className="text-sm">Scope<select name="scope" defaultValue={scope} className="ml-2 rounded border p-2"><option value="company">Company</option><option value="client">Client</option><option value="salesperson">Salesperson</option></select></label> : null}{scope === "client" ? <label className="text-sm">Client<select name="client" defaultValue={params.client ?? clients[0]?.id} className="ml-2 rounded border p-2">{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label> : null}<button className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Run report</button></form><section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">{scope === "company" ? "Company report" : scope === "client" ? "Client report" : "Salesperson report"}</h2>{report ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{["order_count", "client_count", "salesperson_count", "quantity", "sales_amount", "commission_amount"].filter((key) => key in report).map((key) => <div key={key} className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">{key.replaceAll("_", " ")}</p><p className="text-xl font-semibold">{String(report?.[key])}</p></div>)}</div> : <p className="mt-4 text-sm text-slate-500">No report is available for this period.</p>}</section></>;
}
