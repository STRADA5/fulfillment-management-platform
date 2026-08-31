import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { AssignAllocationForm, ConfirmPickForm, PackageForm, PackageContentForm, ShipmentStateForms, VerificationForm } from "@/components/fulfillment/fulfillment-forms";

export default async function FulfillmentShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("fulfillment.shipments.view");
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: shipment }, { data: lines }, { data: packages }, { data: picks }, { data: verification }, { data: allocations }] = await Promise.all([
    supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
    supabase.from("shipment_lines").select("*").eq("shipment_id", id).order("created_at"),
    supabase.from("shipment_packages").select("*").eq("shipment_id", id).order("package_sequence"),
    supabase.from("pick_list_lines").select("*").order("created_at"),
    supabase.from("warehouse_verifications").select("*").eq("shipment_id", id).maybeSingle(),
    supabase.from("order_allocations").select("id,order_line_id,quantity,status,lot_id,warehouse_id,location_id").eq("status", "reserved"),
  ]);
  if (!shipment) notFound();
  const shipmentPicks = (picks ?? []).filter(x => lines?.some(l => l.allocation_id === x.allocation_id));
  const expected = (lines ?? []).reduce((sum, line) => sum + Number(line.quantity), 0);
  return <>
    <PageHeading title={`Shipment ${shipment.shipment_sequence}`} description={`Order ${shipment.order_id} · ${shipment.status} · warehouse-controlled fulfillment.`} />
    <div className="mt-5 rounded border bg-white p-5"><p>Status: <strong>{shipment.status}</strong> · version {shipment.version}</p><ShipmentStateForms shipmentId={id} status={shipment.status} /></div>
    <section className="mt-5 rounded border bg-white p-5"><h2 className="text-xl font-semibold">Reserved allocations</h2>{(allocations ?? []).map(a => <div key={a.id} className="my-2 flex flex-wrap items-center gap-3"><span>{a.quantity} · lot {a.lot_id} · location {a.location_id} · {a.status}</span><AssignAllocationForm shipmentId={id} allocationId={a.id} /></div>)}</section>
    <section className="mt-5 rounded border bg-white p-5"><h2 className="text-xl font-semibold">Shipment contents</h2>{(lines ?? []).map(l => <div key={l.id} className="my-2"><p>{l.quantity} · variant {l.product_variant_id} · lot {l.lot_id} · location {l.location_id}</p>{shipmentPicks.filter(p => p.allocation_id === l.allocation_id).map(p => <ConfirmPickForm key={p.id} pickListId={p.pick_list_id} pickLineId={p.id} quantity={Number(p.quantity_to_pick)} />)}</div>)}{!lines?.length ? <p>No allocations assigned yet.</p> : null}</section>
    <section className="mt-5 rounded border bg-white p-5"><h2 className="text-xl font-semibold">Packages</h2><PackageForm shipmentId={id}/>{(packages ?? []).map(p => <div key={p.id} className="my-3 rounded border p-3"><p>Package {p.package_sequence} · {p.weight ?? "unweighed"} {p.weight_unit} · {p.status}</p>{p.status === "open" ? (lines ?? []).map(l => <PackageContentForm key={`${p.id}-${l.id}`} packageId={p.id} shipmentLineId={l.id} quantity={Number(l.quantity)} />) : null}</div>)}</section>
    <section className="mt-5 rounded border bg-white p-5"><h2 className="text-xl font-semibold">Warehouse verification</h2><p>Expected shipment quantity: {expected}</p><VerificationForm shipmentId={id} expected={expected}/>{verification ? <pre className="mt-3 overflow-auto text-xs">{JSON.stringify(verification, null, 2)}</pre> : null}</section>
  </>;
}
