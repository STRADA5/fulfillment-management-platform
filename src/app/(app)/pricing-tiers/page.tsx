import { requirePermission, can } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { PageHeading } from "@/components/ui/page-heading";
import { CatalogForm, type CatalogField } from "@/components/catalog/catalog-form";
import { savePricingTier, assignPricingTier, savePricingTierPrice } from "@/lib/salespeople/actions";

type AdminContext = { pricing_tiers: Array<{ id: string; code: string; name: string; priority: number; status: string; version: number }>; tier_assignments: Array<{ id: string; client_organization_id: string; pricing_tier_id: string; status: string }> };

export default async function Page() {
  const context = await requirePermission("pricing_tiers.view");
  if (!context.membership) return null;
  const supabase = await createClient();
  const organization = context.membership.organizationId;
  const [{ data: rawAdmin }, { data: rawClients }, { data: rawProducts }] = await Promise.all([
    supabase.rpc("get_phase5b_admin_context", { target_provider_id: organization }),
    supabase.from("organizations").select("id,name").eq("organization_type", "client_company").eq("parent_organization_id", organization).order("name"),
    supabase.from("products").select("id,product_name").eq("organization_id", organization).eq("status", "active").order("product_name"),
  ]);
  const admin = rawAdmin as AdminContext | null;
  const clients = (rawClients ?? []) as Array<{ id: string; name: string }>;
  const products = (rawProducts ?? []) as Array<{ id: string; product_name: string }>;
  const tiers = (admin?.pricing_tiers ?? []).map((tier) => ({ value: tier.id, label: `${tier.name} (${tier.code})` }));
  const clientOptions = clients.map((client) => ({ value: client.id, label: client.name }));
  const tierFields: CatalogField[] = [{ name: "code", label: "Tier code (for example TIER_1)", required: true }, { name: "name", label: "Tier name (for example Tier 1)", required: true }, { name: "description", label: "Description" }, { name: "priority", label: "Priority", type: "number" }, { name: "status", label: "Status", options: [{ value: "active", label: "active" }, { value: "inactive", label: "inactive" }] }];
  const assignmentFields: CatalogField[] = [{ name: "tierId", label: "Pricing tier", options: tiers, required: true }, { name: "clientId", label: "Client", options: clientOptions, required: true }, { name: "effectiveFrom", label: "Effective from", type: "datetime-local" }];
  const priceFields: CatalogField[] = [{ name: "tierId", label: "Pricing tier", options: tiers, required: true }, { name: "productId", label: "Product", options: products.map((product) => ({ value: product.id, label: product.product_name })), required: true }, { name: "variantId", label: "Variant id (optional)" }, { name: "currency", label: "Currency", required: true }, { name: "unitPrice", label: "Unit price", type: "number", required: true }, { name: "minimumQuantity", label: "Minimum quantity", type: "number" }, { name: "maximumQuantity", label: "Maximum quantity", type: "number" }, { name: "startsAt", label: "Starts at", type: "datetime-local" }, { name: "endsAt", label: "Ends at", type: "datetime-local" }, { name: "status", label: "Status", options: [{ value: "active", label: "active" }, { value: "inactive", label: "inactive" }] }];
  return <><PageHeading title="Pricing tiers" description="Configurable provider pricing tiers are resolved at order time and preserved in the order price snapshot." />{can(context, "pricing_tiers.manage") ? <div className="mt-6 grid gap-6 xl:grid-cols-2"><CatalogForm title="Create or update pricing tier" action={savePricingTier} fields={tierFields} values={{ priority: 100, status: "active" }} /><CatalogForm title="Assign a tier to a client" action={assignPricingTier} fields={assignmentFields} /><CatalogForm title="Add tier price" action={savePricingTierPrice} fields={priceFields} values={{ currency: "USD", minimumQuantity: 1, status: "active" }} /></div> : null}<section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Configured tiers</h2>{(admin?.pricing_tiers ?? []).map((tier) => <p key={tier.id} className="mt-2 text-sm">{tier.name} · {tier.code} · priority {tier.priority} · {tier.status}</p>)}{!(admin?.pricing_tiers ?? []).length ? <p className="mt-2 text-sm text-slate-500">No tiers configured.</p> : null}</section></>;
}
