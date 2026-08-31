import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { can, requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function FulfillmentQueuePage() {
  const context = await requirePermission("fulfillment.shipments.view");
  const supabase = await createClient();
  const [{ data: shipments }, { data: picks }] = await Promise.all([
    supabase.from("shipments").select("id,order_id,shipment_sequence,status,created_at,locked_at,dispatched_at").order("created_at", { ascending: false }),
    supabase.from("pick_lists").select("id,order_id,warehouse_id,status,created_at").order("created_at", { ascending: false }),
  ]);
  return <>
    <PageHeading title="Fulfillment queue" description={`Picking, packing, verification, and dispatch for ${context.membership?.organizationName ?? "your organization"}.`} />
    <section className="mt-6 rounded border bg-white p-5"><h2 className="text-xl font-semibold">Shipments</h2>
      {(shipments ?? []).map(s => <p key={s.id} className="my-2"><Link className="text-blue-700" href={`/fulfillment/${s.id}`}>Shipment {s.shipment_sequence}</Link> · order {s.order_id} · {s.status} {s.dispatched_at ? `· dispatched ${s.dispatched_at}` : ""}</p>)}
      {!shipments?.length ? <p className="mt-2 text-sm text-slate-600">No shipments are currently planned.</p> : null}
    </section>
    <section className="mt-6 rounded border bg-white p-5"><h2 className="text-xl font-semibold">Pick lists</h2>
      {(picks ?? []).map(p => <p key={p.id} className="my-2">Pick list {p.id} · order {p.order_id} · {p.status} · warehouse {p.warehouse_id}</p>)}
      {!picks?.length ? <p className="mt-2 text-sm text-slate-600">No pick lists are currently open.</p> : null}
    </section>
    {can(context, "library.view") ? <p className="mt-6 text-sm"><Link className="font-semibold text-blue-700" href="/library">Open Knowledge Library & Tools</Link> for approved fulfillment protocols and reference materials.</p> : null}
  </>;
}
