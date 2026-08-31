import Link from "next/link";
import { FoundationForm, type FoundationField } from "@/components/customers/foundation-form";
import { PageHeading } from "@/components/ui/page-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { assignInventoryLotOwnership, saveClientCapability, saveProductOwnership, saveReferralRelationship, saveReferralRule } from "@/lib/client-relationships/actions";

type Context = {
  capabilities?: { code: string; name: string }[];
  clients?: { id: string; name: string; status: string }[];
  assignments?: { id: string; client_organization_id: string; capability_code: string; status: string; effective_from: string; effective_to: string | null; version: number }[];
  product_ownership?: { id: string; client_organization_id: string; product_id: string; variant_id: string | null; ownership_type: string; fulfillment_mode: string; status: string; version: number }[];
  referrals?: { id: string; affiliate_client_organization_id: string; referred_client_organization_id: string; referral_code: string; status: string; version: number }[];
  referral_rules?: { id: string; relationship_id: string; name: string; basis: string; rate_type: string; rate: number; currency: string; status: string; version: number }[];
};
const statuses = ["inactive", "active", "suspended"].map((value) => ({ value, label: value }));
const relationshipStatuses = ["inactive", "active"].map((value) => ({ value, label: value }));
export default async function Page() {
  const context = await requirePermission("client_capabilities.view");
  const supabase = await createClient();
  const [{ data: raw }, { data: products }, { data: variants }, { data: lots }] = await Promise.all([
    supabase.rpc("get_phase5c_context", { target_provider_id: context.membership!.organizationId }),
    supabase.from("products").select("id,product_name").order("product_name"),
    supabase.from("product_variants").select("id,product_id,sku,variant_name").order("sku"),
    supabase.from("inventory_lots").select("id,lot_number,product_variant_id,ownership_relationship_id").order("lot_number").limit(100),
  ]);
  const data = (raw ?? {}) as Context;
  const clients = data.clients ?? [];
  const label = (id: string) => clients.find((client) => client.id === id)?.name ?? id;
  const clientOptions = clients.filter((client) => client.status === "active").map((client) => ({ value: client.id, label: client.name }));
  const capabilityFields: FoundationField[] = [
    { name: "clientId", label: "Client organization", required: true, options: clientOptions },
    { name: "capabilityCode", label: "Capability", required: true, options: (data.capabilities ?? []).map((item) => ({ value: item.code, label: item.name })) },
    { name: "status", label: "Status", options: statuses },
    { name: "effectiveFrom", label: "Effective from", type: "datetime-local", required: true },
    { name: "effectiveTo", label: "Effective to", type: "datetime-local" },
  ];
  const ownershipFields: FoundationField[] = [
    { name: "clientId", label: "Client organization", required: true, options: clientOptions },
    { name: "productId", label: "Provider catalog product", required: true, options: (products ?? []).map((item) => ({ value: item.id, label: item.product_name })) },
    { name: "variantId", label: "Variant (optional)", options: [{ value: "", label: "All variants" }, ...(variants ?? []).map((item) => ({ value: item.id, label: `${item.sku} — ${item.variant_name}` }))] },
    { name: "ownershipType", label: "Ownership", options: [{ value: "distributor_owned", label: "Distributor owned" }, { value: "client_owned", label: "Client owned" }] },
    { name: "fulfillmentMode", label: "Fulfillment mode", options: [{ value: "none", label: "None" }, { value: "self", label: "Self fulfillment" }, { value: "provider", label: "Provider fulfillment" }, { value: "direct_to_customer", label: "Direct to customer" }] },
    { name: "status", label: "Status", options: relationshipStatuses },
    { name: "effectiveFrom", label: "Effective from", type: "datetime-local", required: true },
    { name: "effectiveTo", label: "Effective to", type: "datetime-local" },
  ];
  const referralFields: FoundationField[] = [
    { name: "affiliateClientId", label: "Affiliate/referring client", required: true, options: clientOptions },
    { name: "referredClientId", label: "Referred client", required: true, options: clientOptions },
    { name: "referralCode", label: "Referral code" },
    { name: "status", label: "Status", options: relationshipStatuses },
    { name: "effectiveFrom", label: "Effective from", type: "datetime-local", required: true },
    { name: "effectiveTo", label: "Effective to", type: "datetime-local" },
  ];
  const referralRuleFields: FoundationField[] = [
    { name: "relationshipId", label: "Referral relationship", required: true, options: (data.referrals ?? []).map((item) => ({ value: item.id, label: `${label(item.affiliate_client_organization_id)} → ${label(item.referred_client_organization_id)}` })) },
    { name: "name", label: "Rule name", required: true },
    { name: "basis", label: "Basis", options: [{ value: "order_subtotal", label: "Order subtotal" }, { value: "order_total", label: "Order total" }] },
    { name: "rateType", label: "Rate type", options: [{ value: "percentage", label: "Percentage" }, { value: "fixed", label: "Fixed" }] },
    { name: "rate", label: "Rate", type: "number", required: true },
    { name: "currency", label: "Currency", required: true },
    { name: "priority", label: "Priority", type: "number" },
    { name: "effectiveFrom", label: "Effective from", type: "datetime-local", required: true },
    { name: "effectiveTo", label: "Effective to", type: "datetime-local" },
    { name: "status", label: "Status", options: relationshipStatuses },
  ];
  const lotFields: FoundationField[] = [
    { name: "lotId", label: "Inventory lot", required: true, options: (lots ?? []).map((item) => ({ value: item.id, label: `${item.lot_number} — ${item.product_variant_id}` })) },
    { name: "relationshipId", label: "Ownership relationship", required: true, options: (data.product_ownership ?? []).map((item) => ({ value: item.id, label: `${label(item.client_organization_id)} · ${item.ownership_type} · ${item.product_id}` })) },
  ];
  return <>
    <PageHeading title="Client roles & relationships" description="One client organization can hold multiple effective-dated capabilities without changing its account type." />
    <p className="mt-3 text-sm text-slate-600">Salesperson attribution remains separate from affiliate attribution. Existing <Link className="text-blue-700" href="/clients">client service relationships</Link> and <Link className="text-blue-700" href="/salespeople">salesperson assignments</Link> remain independent boundaries.</p>
    <div className="mt-8 grid gap-6 xl:grid-cols-2">
      {context.membership?.permissions.includes("client_capabilities.manage") ? <FoundationForm title="Configure client capability" action={saveClientCapability} fields={capabilityFields} values={{ status: "inactive", effectiveFrom: new Date().toISOString().slice(0, 16) }} /> : null}
      {context.membership?.permissions.includes("client_ownership.manage") ? <FoundationForm title="Configure product ownership" action={saveProductOwnership} fields={ownershipFields} values={{ status: "inactive", fulfillmentMode: "none", effectiveFrom: new Date().toISOString().slice(0, 16) }} /> : null}
      {context.membership?.permissions.includes("client_referrals.manage") ? <FoundationForm title="Configure affiliate/referral relationship" action={saveReferralRelationship} fields={referralFields} values={{ status: "inactive", effectiveFrom: new Date().toISOString().slice(0, 16) }} /> : null}
      {context.membership?.permissions.includes("referral_commissions.manage") ? <FoundationForm title="Configure referral commission rule" action={saveReferralRule} fields={referralRuleFields} values={{ basis: "order_subtotal", rateType: "percentage", currency: "USD", priority: 100, status: "inactive", effectiveFrom: new Date().toISOString().slice(0, 16) }} /> : null}
      {context.membership?.permissions.includes("client_ownership.manage") ? <FoundationForm title="Assign inventory lot ownership" action={assignInventoryLotOwnership} fields={lotFields} /> : null}
    </div>
    <h2 className="mt-10 text-xl font-semibold">Configured capabilities</h2>
    {(data.assignments ?? []).map((item) => <p className="my-2 rounded border bg-white p-3" key={item.id}>{label(item.client_organization_id)} · {item.capability_code} · {item.status} · {item.effective_from}{item.effective_to ? ` → ${item.effective_to}` : ""}</p>)}
    <h2 className="mt-10 text-xl font-semibold">Product and inventory ownership</h2>
    {(data.product_ownership ?? []).map((item) => <p className="my-2 rounded border bg-white p-3" key={item.id}>{label(item.client_organization_id)} · product {item.product_id}{item.variant_id ? ` · variant ${item.variant_id}` : " · all variants"} · {item.ownership_type} · {item.fulfillment_mode} · {item.status}</p>)}
    <h2 className="mt-10 text-xl font-semibold">Affiliate/referral relationships</h2>
    {(data.referrals ?? []).map((item) => <p className="my-2 rounded border bg-white p-3" key={item.id}>{label(item.affiliate_client_organization_id)} → {label(item.referred_client_organization_id)} · {item.referral_code || "no code"} · {item.status}</p>)}
    <h2 className="mt-10 text-xl font-semibold">Referral commission rules</h2>
    {(data.referral_rules ?? []).map((item) => <p className="my-2 rounded border bg-white p-3" key={item.id}>{item.name} · {item.rate} {item.rate_type} · {item.basis} · {item.status}</p>)}
  </>;
}
