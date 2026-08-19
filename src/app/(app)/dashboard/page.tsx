import { PageHeading } from "@/components/ui/page-heading";
import { getAppContext } from "@/lib/auth/authorization";

const metrics = ["Open Orders", "Orders Awaiting Fulfillment", "Low Stock Items", "Backorders", "Shipments Today", "QC Issues"];

export default async function DashboardPage() {
  const context = await getAppContext();

  if (!context.membership) {
    return (
      <>
        <PageHeading title="Access pending" description="Your account is authenticated but has no active organization membership." />
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Ask an authorized administrator to activate your organization membership.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeading title="Dashboard" description="Operational metrics will appear here as fulfillment modules are introduced." />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((metric) => (
          <section key={metric} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-medium text-slate-600">{metric}</h2>
            <p className="mt-4 text-2xl font-semibold text-slate-400">—</p>
            <p className="mt-2 text-xs text-slate-500">No data available</p>
          </section>
        ))}
      </div>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900">Recent Activity</h2>
        <p className="mt-4 text-sm text-slate-500">Activity will appear after operational modules are connected.</p>
      </section>
    </>
  );
}
