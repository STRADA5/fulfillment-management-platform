import Link from "next/link";
import { requirePermission, can } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/page-heading";
import { CatalogForm, type CatalogField } from "@/components/catalog/catalog-form";
import { assignClientSalesperson, saveCommissionRule, saveSalesperson, transitionCommission, createCommissionPayout } from "@/lib/salespeople/actions";

type AdminContext = { salespeople: Array<{ id: string; code: string; display_name: string; email: string; status: string; version: number }>; assignments: Array<{ id: string; client_organization_id: string; salesperson_id: string; status: string }>; commission_rules: Array<Record<string, unknown>> };
type Dashboard = { salesperson?: { id: string; display_name: string; code: string }; assigned_clients?: Array<{ id: string; name: string }>; sales_activity?: Array<Record<string, unknown>>; commissions?: Record<string, number>; payouts?: Array<Record<string, unknown>> };

const statuses = ["active", "inactive", "suspended"].map((value) => ({ value, label: value }));
const blankId = { name: "id", label: "Existing record id (optional)" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const context = await requirePermission("salespeople.view");
  if (!context.membership) return null;
  const params = await searchParams;
  const supabase = await createClient();
  const organization = context.membership.organizationId;
  const adminAllowed = can(context, "salespeople.view") || can(context, "commissions.view");
  const [adminResult, dashboardResult, clientsResult] = await Promise.all([
    adminAllowed ? supabase.rpc("get_phase5b_admin_context", { target_provider_id: organization }) : Promise.resolve({ data: null, error: null }),
    params.salespersonId && can(context, "commissions.view") ? supabase.rpc("get_salesperson_dashboard", { target_provider_id: organization, target_salesperson_id: params.salespersonId }) : supabase.rpc("get_salesperson_dashboard", { target_provider_id: organization }),
    can(context, "salesperson.assign") ? supabase.from("organizations").select("id,name").eq("organization_type", "client_company").eq("parent_organization_id", organization).order("name") : Promise.resolve({ data: [] }),
  ]);
  const admin = (adminResult.data ?? null) as AdminContext | null;
  const dashboard = (dashboardResult.data ?? null) as Dashboard | null;
  const clients = (clientsResult.data ?? []) as Array<{ id: string; name: string }>;
  const salespersonOptions = (admin?.salespeople ?? []).filter((item) => item.status === "active").map((item) => ({ value: item.id, label: `${item.display_name} (${item.code})` }));
  const clientOptions = clients.map((item) => ({ value: item.id, label: item.name }));
  const salespersonFields: CatalogField[] = [blankId, { name: "userId", label: "Provider user id (optional)" }, { name: "code", label: "Code", required: true }, { name: "name", label: "Display name", required: true }, { name: "email", label: "Email", type: "email" }, { name: "status", label: "Status", options: statuses }];
  const assignmentFields: CatalogField[] = [{ name: "salespersonId", label: "Salesperson", required: true, options: salespersonOptions }, { name: "clientId", label: "Client", required: true, options: clientOptions }, { name: "effectiveFrom", label: "Effective from", type: "datetime-local" }];
  const ruleFields: CatalogField[] = [{ name: "salespersonId", label: "Salesperson", required: true, options: salespersonOptions }, { name: "clientId", label: "Client (blank = all clients)" }, { name: "name", label: "Rule name", required: true }, { name: "basis", label: "Basis", options: [{ value: "order_subtotal", label: "Order subtotal" }, { value: "order_total", label: "Order total" }] }, { name: "rateType", label: "Rate type", options: [{ value: "percentage", label: "Percentage" }, { value: "fixed", label: "Fixed amount" }] }, { name: "rate", label: "Rate", type: "number", required: true }, { name: "currency", label: "Currency", required: true }, { name: "priority", label: "Priority", type: "number" }, { name: "effectiveFrom", label: "Effective from", type: "datetime-local" }, { name: "effectiveTo", label: "Effective to", type: "datetime-local" }, { name: "status", label: "Status", options: [{ value: "active", label: "active" }, { value: "inactive", label: "inactive" }] }];
  return <>
    <PageHeading title="Salespeople & commissions" description="Provider-only attribution, commission snapshots, payout history, and assigned-client activity." />
    {can(context, "commissions.view") && salespersonOptions.length ? <form className="mt-6 flex items-end gap-3"><label className="text-sm">View salesperson dashboard<select name="salespersonId" defaultValue={params.salespersonId ?? salespersonOptions[0].value} className="mt-1 block rounded border p-2">{salespersonOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><button className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white">View</button></form> : null}
    {dashboard ? <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">{dashboard.salesperson?.display_name ?? "Your salesperson dashboard"}</h2><p className="mt-1 text-sm text-slate-600">Assigned clients: {dashboard.assigned_clients?.length ?? 0} · Orders: {dashboard.sales_activity?.length ?? 0}</p><div className="mt-4 grid gap-3 sm:grid-cols-4">{Object.entries(dashboard.commissions ?? {}).map(([status, amount]) => <div key={status} className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">{status}</p><p className="text-xl font-semibold">{Number(amount).toFixed(2)}</p></div>)}</div><h3 className="mt-5 font-semibold">Assigned clients</h3><div className="mt-2 flex flex-wrap gap-2">{(dashboard.assigned_clients ?? []).map((client) => <span key={client.id} className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-800">{client.name}</span>)}</div></section> : <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">No salesperson dashboard is assigned to this user. Provider administrators can manage salesperson records below.</p>}
    {can(context, "salespeople.manage") && admin ? <div className="mt-6 grid gap-6 xl:grid-cols-2"><CatalogForm title="Salesperson record" action={saveSalesperson} fields={salespersonFields} values={{ status: "active" }} /><CatalogForm title="Commission rule" action={saveCommissionRule} fields={ruleFields} values={{ basis: "order_subtotal", rateType: "percentage", currency: "USD", priority: 100, status: "active" }} /></div> : null}
    {can(context, "salesperson.assign") && admin ? <section className="mt-6"><CatalogForm title="Assign salesperson to client" action={assignClientSalesperson} fields={assignmentFields} /></section> : null}
    {admin ? <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Provider assignments</h2>{admin.assignments.map((assignment) => <p key={assignment.id} className="mt-2 text-sm">{clients.find((client) => client.id === assignment.client_organization_id)?.name ?? assignment.client_organization_id} · {admin.salespeople.find((person) => person.id === assignment.salesperson_id)?.display_name ?? assignment.salesperson_id} · {assignment.status}</p>)}{!admin.assignments.length ? <p className="mt-2 text-sm text-slate-500">No assignments yet.</p> : null}</section> : null}
    {can(context, "commissions.manage") && dashboard?.commissions ? <section className="mt-6"><CatalogForm title="Advance a commission lifecycle" action={transitionCommission} fields={[{ name: "commissionId", label: "Commission snapshot id", required: true }, { name: "status", label: "Next status", options: [{ value: "earned", label: "earned" }, { value: "payable", label: "payable" }, { value: "voided", label: "voided" }] }]} /></section> : null}
    {can(context, "payouts.manage") ? <section className="mt-6"><CatalogForm title="Create commission payout" action={createCommissionPayout} fields={[{ name: "salespersonId", label: "Salesperson", required: true, options: salespersonOptions }, { name: "currency", label: "Currency", required: true }, { name: "commissionIds", label: "Payable snapshot ids (comma separated)", required: true }, { name: "externalReference", label: "External reference" }, { name: "idempotencyKey", label: "Idempotency key", required: true }]} /></section> : null}
    {can(context, "library.view") ? <p className="mt-6 text-sm"><Link className="font-semibold text-blue-700" href="/library">Open Knowledge Library & Tools</Link> for approved salesperson materials and authorized calculator tools.</p> : null}
  </>;
}
