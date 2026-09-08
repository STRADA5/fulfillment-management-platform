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
let passed = 0;
const must = async (promise) => { const result = await promise; if (result.error) throw Error(JSON.stringify(result.error)); return result.data; };
const check = (name, value) => { assert.ok(value, name); console.log(`PASS ${++passed}: ${name}`); };
const denied = async (name, promise) => { const result = await promise; check(name, Boolean(result.error) || !result.data || (Array.isArray(result.data) && result.data.length === 0)); };
async function user(label) {
  const email = `p5b-${label}-${run}@example.test`;
  const password = `Local-${run}-Aa1!`;
  const created = await must(svc.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(created.user.id);
  const client = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, opt);
  await must(client.auth.signInWithPassword({ email, password }));
  return { id: created.user.id, client };
}
async function org(label, type, parent = null) {
  return (await must(svc.from("organizations").insert({ name: `P5B ${label} ${run}`, slug: `p5b-${label}-${run}`, organization_type: type, status: "active", parent_organization_id: parent }).select("id").single())).id;
}

try {
  const seller = await org("seller", "fulfillment_company");
  const clientOrg = await org("client", "client_company", seller);
  const clientOrgB = await org("client-b", "client_company", seller);
  const otherSeller = await org("other-seller", "fulfillment_company");
  const admin = await user("admin");
  const salesUser = await user("sales");
  const salesUserB = await user("sales-b");
  const unrelated = await user("unrelated");
  const client = await user("client");
  const otherClient = await user("other-client");
  const roles = Object.fromEntries((await must(svc.from("roles").select("id,code"))).map((row) => [row.code, row.id]));
  await must(svc.from("organization_memberships").insert([
    { organization_id: seller, user_id: admin.id, role_id: roles.ADMIN, status: "active", is_primary: true },
    { organization_id: seller, user_id: salesUser.id, role_id: roles.STAFF, status: "active", is_primary: false },
    { organization_id: seller, user_id: salesUserB.id, role_id: roles.STAFF, status: "active", is_primary: false },
    { organization_id: seller, user_id: unrelated.id, role_id: roles.STAFF, status: "active", is_primary: false },
    { organization_id: clientOrg, user_id: client.id, role_id: roles.CLIENT_ADMIN, status: "active", is_primary: true },
    { organization_id: otherSeller, user_id: otherClient.id, role_id: roles.ADMIN, status: "active", is_primary: true },
  ]));
  await must(svc.from("client_service_relationships").insert({ organization_id: seller, client_organization_id: clientOrg, status: "active", order_access: "manage", customer_access: "read" }));
  await must(svc.from("client_service_relationships").insert({ organization_id: seller, client_organization_id: clientOrgB, status: "active", order_access: "manage", customer_access: "read" }));

  const salesperson = await must(admin.client.rpc("admin_save_salesperson", { target_id: null, target_provider_id: seller, target_user_id: salesUser.id, target_code: "ALPHA", target_name: "Alpha Sales", target_email: "alpha@example.test", target_status: "active" }));
  check("Salesperson record is created through guarded RPC", Boolean(salesperson));
  const assignment = await must(admin.client.rpc("admin_assign_client_salesperson", { target_provider_id: seller, target_client_id: clientOrg, target_salesperson_id: salesperson, target_effective_from: new Date(Date.now() - 60000).toISOString() }));
  check("Client is assigned to salesperson", Boolean(assignment));
  const salespersonB = await must(admin.client.rpc("admin_save_salesperson", { target_id: null, target_provider_id: seller, target_user_id: salesUserB.id, target_code: "BETA", target_name: "Beta Sales", target_email: "beta@example.test", target_status: "active" }));
  const assignmentB = await must(admin.client.rpc("admin_assign_client_salesperson", { target_provider_id: seller, target_client_id: clientOrgB, target_salesperson_id: salespersonB, target_effective_from: new Date(Date.now() - 60000).toISOString() }));
  check("Second salesperson receives a separate client assignment", Boolean(salespersonB) && Boolean(assignmentB));

  const tier = await must(admin.client.rpc("admin_save_pricing_tier", { target_id: null, target_provider_id: seller, target_code: "TIER_1", target_name: "Tier 1", target_description: "Default preferred client tier", target_priority: 100, target_status: "active" }));
  const tierAssignment = await must(admin.client.rpc("admin_assign_client_pricing_tier", { target_provider_id: seller, target_client_id: clientOrg, target_pricing_tier_id: tier, target_effective_from: new Date(Date.now() - 60000).toISOString() }));
  check("Configurable client pricing tier is assigned", Boolean(tierAssignment));

  const customer = await must(svc.from("customers").insert({ organization_id: clientOrg, customer_number: `P5B-${run.slice(0, 8)}`, display_name: "P5B Customer", status: "active" }).select("id").single());
  const address = await must(svc.from("customer_addresses").insert({ organization_id: clientOrg, customer_id: customer.id, label: "Ship", recipient: "P5B Customer", line1: "1 Local", city: "Austin", country_code: "US", status: "active", is_default_shipping: true, is_default_billing: true }).select("id").single());
  const category = await must(svc.from("product_categories").insert({ organization_id: seller, name: "P5B", slug: `p5b-${run}` }).select("id").single());
  const product = await must(svc.from("products").insert({ organization_id: seller, category_id: category.id, product_name: "Tier Product", search_name: "tier-product", product_type: "supply", default_unit_of_measure: "each" }).select("id").single());
  const variant = await must(svc.from("product_variants").insert({ organization_id: seller, product_id: product.id, sku: `P5B-${run}`, variant_name: "Unit" }).select("id").single());
  const connection = await must(svc.from("client_catalog_connections").insert({ organization_id: seller, client_organization_id: clientOrg, status: "active" }).select("id").single());
  const entry = await must(svc.from("client_catalog_entries").insert({ organization_id: seller, client_organization_id: clientOrg, connection_id: connection.id, product_id: product.id, variant_id: variant.id, public_name: "Tier Product", public_description: "", status: "active", starts_at: "2020-01-01T00:00:00Z" }).select("id").single());
  const tierPrice = await must(admin.client.rpc("admin_save_pricing_tier_price", { target_id: null, target_provider_id: seller, target_pricing_tier_id: tier, target_product_id: product.id, target_variant_id: variant.id, target_currency: "USD", target_unit_price: 12.5, target_minimum_quantity: 1, target_maximum_quantity: null, target_starts_at: new Date(Date.now() - 60000).toISOString(), target_ends_at: null, target_status: "active" }));
  check("Tier price is created and is configurable", Boolean(tierPrice));
  const rule = await must(admin.client.rpc("admin_save_commission_rule", { target_id: null, target_provider_id: seller, target_salesperson_id: salesperson, target_client_id: clientOrg, target_name: "Client 10 percent", target_basis: "order_subtotal", target_rate_type: "percentage", target_rate: 10, target_currency: "USD", target_priority: 100, target_effective_from: new Date(Date.now() - 60000).toISOString(), target_effective_to: null, target_status: "active" }));
  check("Commission rule is configurable per salesperson and client", Boolean(rule));

  const options = await must(client.client.rpc("get_order_intake_options", { target_client_organization_id: clientOrg, target_currency: "USD" }));
  check("Client intake sees tier-resolved selling price without internal rule data", options.catalog?.[0]?.unit_price === 12.5 && !/commission|salesperson|pricing_tier/i.test(JSON.stringify(options)));

  const order = await must(client.client.rpc("submit_order", { target_client_organization_id: clientOrg, target_customer_id: customer.id, target_address_id: address.id, target_currency: "USD", target_lines: [{ entry_id: entry.id, quantity: 2 }], target_idempotency_key: `p5b-order-${run}` }));
  const orderRow = await must(svc.from("orders").select("subtotal,total").eq("id", order).single());
  check("Client order uses assigned tier price", orderRow.subtotal === 25 && orderRow.total === 25);
  const attribution = await must(svc.from("order_salesperson_attributions").select("salesperson_id,assignment_snapshot").eq("order_id", order).single());
  check("Order attribution is persistent and snapshots assignment identity", attribution.salesperson_id === salesperson && attribution.assignment_snapshot.code === "ALPHA");
  const snapshot = await must(svc.from("commission_snapshots").select("id,rate_snapshot,commission_amount,quantity,status,rule_snapshot").eq("order_id", order).single());
  check("Commission snapshot is created with immutable rate and amount", snapshot.rate_snapshot === 10 && snapshot.commission_amount === 2.5 && snapshot.quantity === 2 && snapshot.status === "pending" && snapshot.rule_snapshot.rate === 10);

  const changedRule = await must(admin.client.rpc("admin_save_commission_rule", { target_id: rule, target_provider_id: seller, target_salesperson_id: salesperson, target_client_id: clientOrg, target_name: "Client 20 percent", target_basis: "order_subtotal", target_rate_type: "percentage", target_rate: 20, target_currency: "USD", target_priority: 100, target_effective_from: new Date(Date.now() - 60000).toISOString(), target_effective_to: null, target_status: "active", target_expected_version: 1 }));
  check("Rule changes do not rewrite commission history", Boolean(changedRule) && (await must(svc.from("commission_snapshots").select("rate_snapshot,commission_amount,rule_snapshot").eq("id", snapshot.id).single())).rate_snapshot === 10);
  const globalRule = await must(admin.client.rpc("admin_save_commission_rule", { target_id: null, target_provider_id: seller, target_salesperson_id: salesperson, target_client_id: null, target_name: "Provider-wide fallback", target_basis: "order_subtotal", target_rate_type: "percentage", target_rate: 5, target_currency: "USD", target_priority: 50, target_effective_from: new Date(Date.now() - 60000).toISOString(), target_effective_to: null, target_status: "active" }));
  check("Provider-wide fallback commission rules are supported", Boolean(globalRule));
  await denied("Client cannot directly read commission snapshots", client.client.from("commission_snapshots").select("*"));
  await denied("Unrelated staff cannot directly read commission snapshots", unrelated.client.from("commission_snapshots").select("*"));
  await denied("Client cannot invoke confidential salesperson dashboard", client.client.rpc("get_salesperson_dashboard", { target_provider_id: seller }));
  const ownDashboard = await must(salesUser.client.rpc("get_salesperson_dashboard", { target_provider_id: seller }));
  check("Salesperson dashboard is self-scoped", ownDashboard.salesperson.id === salesperson && ownDashboard.sales_activity.length === 1 && ownDashboard.commissions.pending === 2.5);
  const ownAdminContext = await must(salesUser.client.rpc("get_phase5b_admin_context", { target_provider_id: seller }));
  check("STAFF context contains only the signed-in salesperson and assigned client", ownAdminContext.salespeople.length === 1 && ownAdminContext.salespeople[0].id === salesperson && ownAdminContext.assignments.length === 1 && ownAdminContext.assignments[0].client_organization_id === clientOrg);
  const otherOwnDashboard = await must(salesUserB.client.rpc("get_salesperson_dashboard", { target_provider_id: seller }));
  check("Second salesperson dashboard is symmetrically self-scoped", otherOwnDashboard.salesperson.id === salespersonB && otherOwnDashboard.assigned_clients.length === 1 && otherOwnDashboard.assigned_clients[0].id === clientOrgB);
  const otherOwnAdminContext = await must(salesUserB.client.rpc("get_phase5b_admin_context", { target_provider_id: seller }));
  check("Second STAFF context excludes the first salesperson assignment", otherOwnAdminContext.salespeople.length === 1 && otherOwnAdminContext.salespeople[0].id === salespersonB && otherOwnAdminContext.assignments.length === 1 && otherOwnAdminContext.assignments[0].client_organization_id === clientOrgB);
  const providerContext = await must(admin.client.rpc("get_phase5b_admin_context", { target_provider_id: seller }));
  check("Provider admin retains provider-wide salesperson visibility", providerContext.salespeople.some((entry) => entry.id === salesperson) && providerContext.salespeople.some((entry) => entry.id === salespersonB) && providerContext.assignments.some((entry) => entry.client_organization_id === clientOrg) && providerContext.assignments.some((entry) => entry.client_organization_id === clientOrgB));
  await denied("Salesperson A cannot view salesperson B dashboard", salesUser.client.rpc("get_salesperson_dashboard", { target_provider_id: seller, target_salesperson_id: salespersonB }));
  await denied("Salesperson B cannot view salesperson A dashboard", salesUserB.client.rpc("get_salesperson_dashboard", { target_provider_id: seller, target_salesperson_id: salesperson }));
  await denied("Unrelated salesperson cannot view another salesperson dashboard", unrelated.client.rpc("get_salesperson_dashboard", { target_provider_id: seller, target_salesperson_id: salesperson }));
  const adminReport = await must(admin.client.rpc("get_company_sales_report", { target_provider_id: seller, target_start: new Date(Date.now() - 86400000).toISOString(), target_end: new Date(Date.now() + 86400000).toISOString() }));
  check("Company report includes order, quantity, sales, and commissions", adminReport.order_count === 1 && adminReport.quantity === 2 && adminReport.sales_amount === 25 && adminReport.commission_amount === 2.5);
  await denied("Other tenant cannot access company report", otherClient.client.rpc("get_company_sales_report", { target_provider_id: seller, target_start: new Date(Date.now() - 86400000).toISOString(), target_end: new Date(Date.now() + 86400000).toISOString() }));

  await must(admin.client.rpc("transition_commission", { target_commission_id: snapshot.id, target_status: "earned" }));
  await must(admin.client.rpc("transition_commission", { target_commission_id: snapshot.id, target_status: "payable" }));
  const payable = await must(svc.from("commission_snapshots").select("status,earned_at,payable_at").eq("id", snapshot.id).single());
  check("Commission lifecycle reaches payable with timestamps", payable.status === "payable" && Boolean(payable.earned_at) && Boolean(payable.payable_at));
  const payoutAttempts = await Promise.all([admin.client.rpc("admin_create_commission_payout", { target_provider_id: seller, target_salesperson_id: salesperson, target_currency: "USD", target_commission_ids: [snapshot.id], target_external_reference: "LOCAL-ACH-1", target_idempotency_key: `payout-${run}` }), admin.client.rpc("admin_create_commission_payout", { target_provider_id: seller, target_salesperson_id: salesperson, target_currency: "USD", target_commission_ids: [snapshot.id], target_external_reference: "LOCAL-ACH-1-retry", target_idempotency_key: `payout-${run}` })]);
  const payout = payoutAttempts.find((attempt) => !attempt.error)?.data;
  check("Concurrent payout requests are idempotent", payoutAttempts.every((attempt) => !attempt.error) && payoutAttempts.every((attempt) => attempt.data === payout));
  const payoutRetry = await must(admin.client.rpc("admin_create_commission_payout", { target_provider_id: seller, target_salesperson_id: salesperson, target_currency: "USD", target_commission_ids: [snapshot.id], target_external_reference: "retry", target_idempotency_key: `payout-${run}` }));
  const paid = await must(svc.from("commission_snapshots").select("status,paid_at").eq("id", snapshot.id).single());
  const payoutRow = await must(svc.from("commission_payouts").select("status,total_amount").eq("id", payout).single());
  check("Payout marks commission paid and is idempotent", payout === payoutRetry && paid.status === "paid" && Boolean(paid.paid_at) && payoutRow.status === "paid" && payoutRow.total_amount === 2.5);
  await denied("Commission history cannot be directly rewritten", admin.client.from("commission_snapshots").update({ commission_amount: 999 }).eq("id", snapshot.id));
  const events = await must(svc.from("commission_lifecycle_events").select("action,new_status").eq("commission_snapshot_id", snapshot.id));
  check("Commission lifecycle is append-only and audited", events.some((event) => event.new_status === "pending") && events.some((event) => event.new_status === "earned") && events.some((event) => event.new_status === "payable") && events.some((event) => event.new_status === "paid"));
  const audit = await must(svc.from("audit_logs").select("action").eq("organization_id", seller));
  check("Salesperson and commission operations create trusted audit events", audit.some((row) => row.action === "salesperson.saved") && audit.some((row) => row.action === "salesperson.assigned") && audit.some((row) => row.action === "commission.snapshot_created") && audit.some((row) => row.action === "commission.payout_created"));
  await denied("Anonymous Phase 5B report access denied", anon.rpc("get_company_sales_report", { target_provider_id: seller, target_start: new Date(Date.now() - 86400000).toISOString(), target_end: new Date(Date.now() + 86400000).toISOString() }));
  await must(svc.from("profiles").update({ status: "suspended" }).eq("id", salesUser.id));
  await denied("Suspended salesperson dashboard access denied", salesUser.client.rpc("get_salesperson_dashboard", { target_provider_id: seller }));
} catch (error) {
  console.error("PHASE 5B FAILURE", error);
  process.exitCode = 1;
} finally {
  for (const id of users) { try { await svc.auth.admin.deleteUser(id); } catch {} }
}


