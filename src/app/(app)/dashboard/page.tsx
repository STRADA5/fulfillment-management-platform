import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { can, getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { NotificationControls } from "@/components/notifications/notification-controls";

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

  const supabase = await createClient();
  const canManageNotifications = context.membership.permissions.includes("notifications.manage");
  const [{ data: notifications }, { data: alerts }] = await Promise.all([
    supabase.rpc("get_client_notification_feed", { target_limit: 25 }),
    canManageNotifications ? supabase.rpc("get_internal_alert_feed", { target_organization_id: context.membership.organizationId, target_limit: 25 }) : Promise.resolve({ data: [] }),
  ]);
  const notificationRows = Array.isArray(notifications) ? notifications as Array<{ event_type?: string; payload?: { status?: string; order_number?: string }; created_at?: string }> : [];
  const alertRows = Array.isArray(alerts) ? alerts as Array<{ alert_type?: string; severity?: string; title?: string; message?: string; created_at?: string }> : [];

  return (
    <>
      <PageHeading title="Dashboard" description="Trusted order, shipment, and operational events are projected here for your organization." />
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
        <h2 className="font-semibold text-slate-900">Client-safe updates</h2>
        {notificationRows.length ? <ul className="mt-4 divide-y divide-slate-100">{notificationRows.map((row, index) => <li key={`${row.event_type}-${row.created_at}-${index}`} className="py-3"><p className="text-sm font-medium text-slate-900">{row.event_type}</p><p className="text-xs text-slate-500">{row.payload?.order_number ? `${row.payload.order_number} · ` : ""}{row.payload?.status ?? "Status update"}{row.created_at ? ` · ${new Date(row.created_at).toLocaleString()}` : ""}</p></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">No client-safe updates yet.</p>}
      </section>
      {canManageNotifications ? <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-900">Internal staff alerts</h2>{alertRows.length ? <ul className="mt-4 divide-y divide-slate-100">{alertRows.map((row, index) => <li key={`${row.alert_type}-${row.created_at}-${index}`} className="py-3"><p className="text-sm font-medium text-slate-900">{row.title ?? row.alert_type}</p><p className="text-xs text-slate-600">{row.message} · {row.severity}</p></li>)}</ul> : <p className="mt-4 text-sm text-slate-500">No internal alerts yet.</p>}</section> : null}
      <NotificationControls organizationId={context.membership.organizationId} canManage={canManageNotifications} />
      {can(context, "library.view") ? <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-semibold text-slate-900">Knowledge Library & Tools</h2><p className="mt-2 text-sm text-slate-600">Approved protocols, research, reference materials, and calculator tools.</p><Link className="mt-3 inline-block text-sm font-semibold text-blue-700" href="/library">Open library</Link></section> : null}
    </>
  );
}
