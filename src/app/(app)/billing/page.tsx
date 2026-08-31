import { PageHeading } from "@/components/ui/page-heading";
import { getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

type InvoiceRow = { id: string; invoice_number: string; status: string; currency: string; total: number; amount_paid: number; balance_due: number; created_at: string };
export default async function BillingPage() {
  const context = await getAppContext();
  if (!context.membership) return <><PageHeading title="Billing" description="Financial access requires an active organization membership." /></>;
  const supabase = await createClient();
  const canView = context.membership.permissions.includes("billing.view");
  if (!canView) return <><PageHeading title="Billing" description="Billing access is not granted for this organization." /></>;
  const [{ data: invoices }, { data: clientSummary }] = await Promise.all([
    supabase.from("invoices").select("id,invoice_number,status,currency,total,amount_paid,balance_due,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.rpc("get_client_financial_summary", { target_client_organization_id: context.membership.organizationId }),
  ]);
  const directRows = (invoices ?? []) as InvoiceRow[];
  const projectedRows = Array.isArray((clientSummary as { invoices?: unknown } | null)?.invoices) ? ((clientSummary as { invoices: InvoiceRow[] }).invoices) : [];
  const rows = directRows.length ? directRows : projectedRows;
  return <>
    <PageHeading title="Billing & financial history" description="Immutable invoice, payment, credit, refund, and balance records for the active organization context." />
    <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-semibold text-slate-900">Invoices and balances</h2>
      {rows.length ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Invoice</th><th className="p-2">Status</th><th className="p-2">Total</th><th className="p-2">Paid</th><th className="p-2">Balance due</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-slate-100"><td className="p-2 font-medium">{row.invoice_number}</td><td className="p-2">{row.status}</td><td className="p-2">{row.currency} {row.total}</td><td className="p-2">{row.currency} {row.amount_paid}</td><td className="p-2">{row.currency} {row.balance_due}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-slate-500">No invoices are available in this organization context.</p>}
    </section>
    <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700"><p>Financial records are server-calculated and immutable after issuance. Client views never include supplier identity, acquisition cost, margin, QC, warehouse, or provider-secret data.</p></section>
  </>;
}
