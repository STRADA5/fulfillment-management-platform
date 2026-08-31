import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.LOCAL_SUPABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw Error("LOCAL Supabase only");
const opt = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY, opt);
const anon = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, opt);
const run = randomUUID();
const users = [];
const orgs = [];
let passed = 0;
const must = async (promise) => { const result = await promise; if (result.error) throw Error(JSON.stringify(result.error)); return result.data; };
const check = (name, value) => { assert.ok(value, name); console.log(`PASS ${++passed}: ${name}`); };
const denied = async (name, promise) => { const result = await promise; check(name, Boolean(result.error) || !result.data || (Array.isArray(result.data) && result.data.length === 0)); };
async function user(label) {
  const email = `p5c-${label}-${run}@example.test`, password = `Local-${run}-Aa1!`;
  const created = await must(svc.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(created.user.id);
  const client = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, opt);
  await must(client.auth.signInWithPassword({ email, password }));
  return { id: created.user.id, client };
}
async function org(label, type, parent = null) {
  const row = await must(svc.from("organizations").insert({ name: `P5C ${label} ${run}`, slug: `p5c-${label}-${run}`, organization_type: type, status: "active", parent_organization_id: parent }).select("id").single());
  orgs.push(row.id); return row.id;
}

try {
  const seller = await org("seller", "fulfillment_company");
  const affiliateClient = await org("affiliate", "client_company", seller);
  const buyingClient = await org("buyer", "client_company", seller);
  const otherSeller = await org("other-seller", "fulfillment_company");
  const admin = await user("admin");
  const salespersonUser = await user("salesperson");
  const affiliateUser = await user("affiliate-user");
  const buyerUser = await user("buyer-user");
  const otherAdmin = await user("other-admin");
  const roles = Object.fromEntries((await must(svc.from("roles").select("id,code"))).map((row) => [row.code, row.id]));
  await must(svc.from("organization_memberships").insert([
    { organization_id: seller, user_id: admin.id, role_id: roles.ADMIN, status: "active", is_primary: true },
    { organization_id: seller, user_id: salespersonUser.id, role_id: roles.STAFF, status: "active", is_primary: false },
    { organization_id: affiliateClient, user_id: affiliateUser.id, role_id: roles.CLIENT_ADMIN, status: "active", is_primary: true },
    { organization_id: buyingClient, user_id: buyerUser.id, role_id: roles.CLIENT_ADMIN, status: "active", is_primary: true },
    { organization_id: otherSeller, user_id: otherAdmin.id, role_id: roles.ADMIN, status: "active", is_primary: true },
  ]));
  await must(svc.from("client_service_relationships").insert([
    { organization_id: seller, client_organization_id: affiliateClient, status: "active", customer_access: "read", order_access: "manage" },
    { organization_id: seller, client_organization_id: buyingClient, status: "active", customer_access: "read", order_access: "manage" },
  ]));

  const context = await must(admin.client.rpc("get_phase5c_context", { target_provider_id: seller }));
  check("Provider context exposes extensible client capabilities", context.capabilities.some((item) => item.code === "self_fulfillment") && context.capabilities.some((item) => item.code === "supplier_brand_partner"));
  const capabilityAt = new Date(Date.now() - 60000).toISOString();
  const self = await must(admin.client.rpc("admin_save_client_capability", { target_id: null, target_provider_id: seller, target_client_id: buyingClient, target_capability_code: "self_fulfillment", target_status: "active", target_effective_from: capabilityAt, target_effective_to: null, target_configuration: {}, target_expected_version: null }));
  const affiliateCap = await must(admin.client.rpc("admin_save_client_capability", { target_id: null, target_provider_id: seller, target_client_id: affiliateClient, target_capability_code: "affiliate_referral", target_status: "active", target_effective_from: capabilityAt, target_effective_to: null, target_configuration: {}, target_expected_version: null }));
  const ownedCap = await must(admin.client.rpc("admin_save_client_capability", { target_id: null, target_provider_id: seller, target_client_id: buyingClient, target_capability_code: "client_owned_products", target_status: "active", target_effective_from: capabilityAt, target_effective_to: null, target_configuration: {}, target_expected_version: null }));
  check("One client can hold multiple independent capabilities", Boolean(self && ownedCap) && Boolean(affiliateCap));
  await denied("Cross-provider capability assignment denied", otherAdmin.client.rpc("admin_save_client_capability", { target_id: null, target_provider_id: seller, target_client_id: buyingClient, target_capability_code: "self_fulfillment", target_status: "active", target_effective_from: capabilityAt, target_effective_to: null, target_configuration: {}, target_expected_version: null }));
  await denied("Overlapping capability interval denied", admin.client.rpc("admin_save_client_capability", { target_id: null, target_provider_id: seller, target_client_id: buyingClient, target_capability_code: "self_fulfillment", target_status: "active", target_effective_from: capabilityAt, target_effective_to: null, target_configuration: {}, target_expected_version: null }));

  const category = await must(svc.from("product_categories").insert({ organization_id: seller, name: "P5C", slug: `p5c-${run}` }).select("id").single());
  const product = await must(svc.from("products").insert({ organization_id: seller, category_id: category.id, product_name: "Owned Product", search_name: "owned-product", product_type: "supply", default_unit_of_measure: "each" }).select("id").single());
  const variant = await must(svc.from("product_variants").insert({ organization_id: seller, product_id: product.id, sku: `P5C-${run}`, variant_name: "Unit" }).select("id").single());
  const ownership = await must(admin.client.rpc("admin_save_client_product_ownership", { target_id: null, target_provider_id: seller, target_client_id: buyingClient, target_product_id: product.id, target_variant_id: variant.id, target_ownership_type: "client_owned", target_fulfillment_mode: "self", target_status: "active", target_effective_from: capabilityAt, target_effective_to: null, target_expected_version: null }));
  check("Client-owned product relationship is accepted", Boolean(ownership));
  await denied("Provider fulfillment mode requires its capability", admin.client.rpc("admin_save_client_product_ownership", { target_id: null, target_provider_id: seller, target_client_id: buyingClient, target_product_id: product.id, target_variant_id: variant.id, target_ownership_type: "client_owned", target_fulfillment_mode: "provider", target_status: "active", target_effective_from: new Date().toISOString(), target_effective_to: null, target_expected_version: null }));
  await denied("Cross-product variant injection denied", admin.client.rpc("admin_save_client_product_ownership", { target_id: null, target_provider_id: seller, target_client_id: buyingClient, target_product_id: product.id, target_variant_id: randomUUID(), target_ownership_type: "client_owned", target_fulfillment_mode: "self", target_status: "active", target_effective_from: new Date().toISOString(), target_effective_to: null, target_expected_version: null }));
  const lot = await must(svc.from("inventory_lots").insert({ organization_id: seller, product_variant_id: variant.id, lot_number: `P5C-${run}`, quantity_received: 10, unit_of_measure: "each", status: "available" }).select("id").single());
  await must(admin.client.rpc("admin_assign_inventory_lot_ownership", { target_provider_id: seller, target_lot_id: lot.id, target_relationship_id: ownership }));
  const lotOwner = await must(svc.from("inventory_lots").select("ownership_relationship_id").eq("id", lot.id).single());
  check("Inventory lot preserves client ownership relationship", lotOwner.ownership_relationship_id === ownership);

  const salesperson = await must(admin.client.rpc("admin_save_salesperson", { target_id: null, target_provider_id: seller, target_user_id: salespersonUser.id, target_code: "P5C", target_name: "P5C Sales", target_email: "p5c-sales@example.test", target_status: "active" }));
  await must(admin.client.rpc("admin_assign_client_salesperson", { target_provider_id: seller, target_client_id: buyingClient, target_salesperson_id: salesperson, target_effective_from: capabilityAt }));
  const referral = await must(admin.client.rpc("admin_save_client_referral_relationship", { target_id: null, target_provider_id: seller, target_affiliate_client_id: affiliateClient, target_referred_client_id: buyingClient, target_referral_code: "AFF-P5C", target_status: "active", target_effective_from: capabilityAt, target_effective_to: null, target_expected_version: null }));
  check("Affiliate relationship is separate from salesperson assignment", Boolean(referral) && (await must(svc.from("client_salesperson_assignments").select("id").eq("client_organization_id", buyingClient))).length === 1);
  const rule = await must(admin.client.rpc("admin_save_referral_commission_rule", { target_id: null, target_provider_id: seller, target_relationship_id: referral, target_name: "Affiliate 10 percent", target_basis: "order_subtotal", target_rate_type: "percentage", target_rate: 10, target_currency: "USD", target_priority: 100, target_effective_from: capabilityAt, target_effective_to: null, target_status: "active", target_expected_version: null }));
  check("Referral commission rule is independently configurable", Boolean(rule));
  await denied("Overlapping referral commission rule denied", admin.client.rpc("admin_save_referral_commission_rule", { target_id: null, target_provider_id: seller, target_relationship_id: referral, target_name: "Overlap", target_basis: "order_subtotal", target_rate_type: "percentage", target_rate: 20, target_currency: "USD", target_priority: 100, target_effective_from: capabilityAt, target_effective_to: null, target_status: "active", target_expected_version: null }));

  const customer = await must(svc.from("customers").insert({ organization_id: buyingClient, customer_number: `P5C-${run.slice(0, 8)}`, display_name: "P5C Customer", status: "active" }).select("id").single());
  const address = await must(svc.from("customer_addresses").insert({ organization_id: buyingClient, customer_id: customer.id, label: "Ship", recipient: "P5C Customer", line1: "1 Local", city: "Austin", country_code: "US", status: "active", is_default_shipping: true, is_default_billing: true }).select("id").single());
  const connection = await must(svc.from("client_catalog_connections").insert({ organization_id: seller, client_organization_id: buyingClient, status: "active" }).select("id").single());
  const entry = await must(svc.from("client_catalog_entries").insert({ organization_id: seller, client_organization_id: buyingClient, connection_id: connection.id, product_id: product.id, variant_id: variant.id, public_name: "Owned Product", public_description: "", status: "active", starts_at: "2020-01-01T00:00:00Z" }).select("id").single());
  await must(svc.from("client_selling_prices").insert({ organization_id: seller, client_organization_id: buyingClient, product_id: product.id, variant_id: variant.id, price_kind: "client", currency: "USD", unit_price: 25, minimum_quantity: 1, status: "active", starts_at: "2020-01-01T00:00:00Z" }));
  const order = await must(buyerUser.client.rpc("submit_order", { target_client_organization_id: buyingClient, target_customer_id: customer.id, target_address_id: address.id, target_currency: "USD", target_lines: [{ entry_id: entry.id, quantity: 2 }], target_idempotency_key: `p5c-order-${run}` }));
  const attrs = await must(svc.from("order_referral_attributions").select("affiliate_client_organization_id,referred_client_organization_id,relationship_snapshot").eq("order_id", order).single());
  const salesAttr = await must(svc.from("order_salesperson_attributions").select("salesperson_id").eq("order_id", order).single());
  check("Order stores independent affiliate and salesperson attribution", attrs.affiliate_client_organization_id === affiliateClient && attrs.referred_client_organization_id === buyingClient && salesAttr.salesperson_id === salesperson);
  const snapshot = await must(svc.from("referral_commission_snapshots").select("id,rate_snapshot,commission_amount,status,rule_snapshot").eq("order_id", order).single());
  check("Referral commission snapshot is immutable and calculated", snapshot.rate_snapshot === 10 && snapshot.commission_amount === 5 && snapshot.status === "pending" && snapshot.rule_snapshot.rate === 10);
  await denied("Affiliate client cannot directly read referral snapshots", affiliateUser.client.from("referral_commission_snapshots").select("*"));
  await denied("Anonymous client cannot read referral attributions", anon.from("order_referral_attributions").select("*"));
  const dashboard = await must(admin.client.rpc("get_client_referral_dashboard", { target_provider_id: seller, target_affiliate_client_id: affiliateClient }));
  check("Provider referral dashboard is scoped to affiliate client", dashboard.commissions.length === 1 && dashboard.commissions[0].commission_amount === 5);
  await denied("Unrelated tenant cannot access referral dashboard", otherAdmin.client.rpc("get_client_referral_dashboard", { target_provider_id: seller, target_affiliate_client_id: affiliateClient }));
  await must(admin.client.rpc("transition_referral_commission", { target_commission_id: snapshot.id, target_status: "earned" }));
  await must(admin.client.rpc("transition_referral_commission", { target_commission_id: snapshot.id, target_status: "payable" }));
  const payoutAttempts = await Promise.all([1, 2].map((n) => admin.client.rpc("admin_create_referral_payout", { target_provider_id: seller, target_affiliate_client_id: affiliateClient, target_currency: "USD", target_commission_ids: [snapshot.id], target_external_reference: `LOCAL-P5C-${n}`, target_idempotency_key: `p5c-payout-${run}` })));
  check("Concurrent referral payout requests are idempotent", payoutAttempts.every((item) => !item.error) && payoutAttempts[0].data === payoutAttempts[1].data);
  const paid = await must(svc.from("referral_commission_snapshots").select("status").eq("id", snapshot.id).single());
  check("Referral payout marks only its independent ledger paid", paid.status === "paid" && (await must(svc.from("commission_snapshots").select("id").eq("order_id", order))).length === 0);
  await denied("Referral commission direct rewrite denied", affiliateUser.client.from("referral_commission_snapshots").update({ commission_amount: 0 }).eq("id", snapshot.id));
  const audits = await must(svc.from("audit_logs").select("action,metadata").eq("organization_id", seller));
  check("Capability, ownership, referral, commission, and payout actions are audited", ["client.capability_created", "client.product_ownership_created", "client.referral_created", "referral_commission.created", "referral_payout.created"].every((action) => audits.some((event) => event.action === action)));
  console.log(`Phase 5C: ${passed} checks passed.`);
} catch (error) {
  console.error("PHASE 5C FAILURE", error);
  process.exitCode = 1;
} finally {
  try {
    const payouts = await svc.from("referral_payouts").select("id").in("organization_id", orgs);
    if (payouts.data?.length) await svc.from("referral_payout_lines").delete().in("payout_id", payouts.data.map((item) => item.id));
    for (const table of ["referral_payout_events", "referral_payouts", "referral_commission_lifecycle_events", "referral_commission_snapshots", "order_referral_attributions", "referral_commission_rules", "client_referral_relationships"]) await svc.from(table).delete().in("organization_id", orgs);
    await svc.from("inventory_lots").update({ ownership_relationship_id: null }).in("organization_id", orgs);
    for (const table of ["client_product_ownership_relationships", "client_capability_events", "client_capability_assignments"]) await svc.from(table).delete().in("organization_id", orgs);
    for (const table of ["order_lifecycle_events", "order_verifications", "order_lines", "orders", "order_number_counters", "verification_number_counters", "client_service_relationships", "customer_address_revisions", "customer_addresses", "customers", "client_selling_prices", "client_catalog_entries", "client_catalog_connections", "inventory_lots", "product_variants", "products", "product_categories", "organization_memberships", "audit_logs"]) await svc.from(table).delete().in("organization_id", orgs);
    for (const id of [...orgs].reverse()) await svc.from("organizations").delete().eq("id", id);
    for (const id of users) await svc.auth.admin.deleteUser(id);
  } catch (error) { console.error("LOCAL cleanup failure", error); process.exitCode = 1; }
}
