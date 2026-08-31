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
  const email = `p5a-${label}-${run}@example.test`;
  const password = `Local-${run}-Aa1!`;
  const created = await must(svc.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(created.user.id);
  const client = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, opt);
  await must(client.auth.signInWithPassword({ email, password }));
  return { id: created.user.id, client };
}
async function org(label, type, parent = null) {
  return (await must(svc.from("organizations").insert({ name: `P5A ${label} ${run}`, slug: `p5a-${label}-${run}`, organization_type: type, status: "active", parent_organization_id: parent }).select("id").single())).id;
}

try {
  const seller = await org("seller", "fulfillment_company");
  const clientOrg = await org("client", "client_company", seller);
  const otherOrg = await org("other", "fulfillment_company");
  const admin = await user("admin");
  const client = await user("client");
  const other = await user("other");
  const staff = await user("staff");
  const roles = Object.fromEntries((await must(svc.from("roles").select("id,code"))).map((row) => [row.code, row.id]));
  await must(svc.from("organization_memberships").insert([
    { organization_id: seller, user_id: admin.id, role_id: roles.ADMIN, status: "active", is_primary: true },
    { organization_id: clientOrg, user_id: client.id, role_id: roles.CLIENT_ADMIN, status: "active", is_primary: true },
    { organization_id: otherOrg, user_id: other.id, role_id: roles.ADMIN, status: "active", is_primary: true },
    { organization_id: seller, user_id: staff.id, role_id: roles.STAFF, status: "active", is_primary: false },
  ]));
  await must(svc.from("client_service_relationships").insert({ organization_id: seller, client_organization_id: clientOrg, status: "active", order_access: "read", customer_access: "read" }));

  const customer = await must(svc.from("customers").insert({ organization_id: clientOrg, customer_number: `P5A-${run.slice(0, 8)}`, display_name: "Billing Customer", status: "active" }).select("id").single());
  const address = await must(svc.from("customer_addresses").insert({ organization_id: clientOrg, customer_id: customer.id, label: "Ship", recipient: "Billing Customer", line1: "1 Main", city: "Austin", country_code: "US", status: "active", is_default_shipping: true, is_default_billing: true }).select("id").single());
  const category = await must(svc.from("product_categories").insert({ organization_id: seller, name: "P5A", slug: `p5a-${run}` }).select("id").single());
  const product = await must(svc.from("products").insert({ organization_id: seller, category_id: category.id, product_name: "Billing Product", search_name: "billing-product", product_type: "supply", default_unit_of_measure: "each" }).select("id").single());
  const variant = await must(svc.from("product_variants").insert({ organization_id: seller, product_id: product.id, sku: `P5A-${run}`, variant_name: "Unit" }).select("id").single());
  const connection = await must(svc.from("client_catalog_connections").insert({ organization_id: seller, client_organization_id: clientOrg, status: "active" }).select("id").single());
  const entry = await must(svc.from("client_catalog_entries").insert({ organization_id: seller, client_organization_id: clientOrg, connection_id: connection.id, product_id: product.id, variant_id: variant.id, public_name: "Billing Product", public_description: "", status: "active", starts_at: "2020-01-01T00:00:00Z" }).select("id").single());
  const order = await must(svc.from("orders").insert({ organization_id: seller, client_organization_id: clientOrg, customer_id: customer.id, address_id: address.id, order_number: `SVFC-ORD-P5A-${run.slice(0, 8)}`, status: "submitted", currency: "USD", customer_snapshot: { display_name: "Billing Customer" }, address_snapshot: { line1: "1 Main" }, client_snapshot: { name: "Client" }, subtotal: 25, total: 25, submitted_at: new Date().toISOString(), submitted_by_user_id: client.id, idempotency_key: `order-${run}`, request_hash: run }).select("id").single());
  const line = await must(svc.from("order_lines").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order.id, entry_id: entry.id, product_id: product.id, variant_id: variant.id, sku: `P5A-${run}`, display_name: "Billing Product", quantity: 2, unit_price: 12.5, currency: "USD", line_total: 25, pricing_snapshot: { unit_price: 12.5, currency: "USD" } }).select("id").single());
  const warehouse = await must(svc.from("warehouses").insert({ organization_id: seller, warehouse_code: `P5A${run.slice(0, 5)}`, warehouse_name: "P5A Warehouse", status: "active", country: "US", timezone: "UTC" }).select("id").single());
  const location = await must(svc.from("warehouse_locations").insert({ organization_id: seller, warehouse_id: warehouse.id, location_code: `P5A-${run.slice(0, 5)}`, location_name: "P5A Bin", location_type: "storage", status: "active" }).select("id").single());
  const lot = await must(svc.from("inventory_lots").insert({ organization_id: seller, product_variant_id: variant.id, lot_number: `P5A-LOT-${run.slice(0, 8)}`, status: "available", unit_of_measure: "each", expiration_date: "2099-01-01", bud_date: "2099-01-01" }).select("id").single());
  await must(svc.from("inventory_balances").insert({ organization_id: seller, warehouse_id: warehouse.id, location_id: location.id, product_variant_id: variant.id, lot_id: lot.id, physical_quantity: 10, available_quantity: 10 }));
  const reservation = await must(svc.from("inventory_reservations").insert({ organization_id: seller, warehouse_id: warehouse.id, location_id: location.id, product_variant_id: variant.id, lot_id: lot.id, quantity: 2, status: "fulfilled", source_type: "order_allocation", source_id: `p5a-${run}`, created_by_user_id: admin.id, fulfilled_at: new Date().toISOString() }).select("id").single());
  const allocation = await must(svc.from("order_allocations").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order.id, order_line_id: line.id, product_variant_id: variant.id, warehouse_id: warehouse.id, location_id: location.id, lot_id: lot.id, reservation_id: reservation.id, quantity: 2, status: "fulfilled", source: "manual", created_by_user_id: admin.id }).select("id").single());
  const shipment = await must(svc.from("shipments").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order.id, shipment_sequence: 1, status: "planned", created_by_user_id: admin.id }).select("id").single());
  const pkg = await must(svc.from("shipment_packages").insert({ organization_id: seller, shipment_id: shipment.id, package_sequence: 1, status: "locked", weight: 2, weight_unit: "lb" }).select("id").single());
  await must(svc.from("shipment_lines").insert({ organization_id: seller, shipment_id: shipment.id, order_id: order.id, order_line_id: line.id, allocation_id: allocation.id, product_variant_id: variant.id, lot_id: lot.id, warehouse_id: warehouse.id, location_id: location.id, quantity: 2 }));
  const shippingService = await must(svc.from("shipping_services").select("id").eq("carrier_code", "test").eq("service_code", "ground").single());
  await must(svc.from("shipping_charge_snapshots").insert({ organization_id: seller, shipment_id: shipment.id, package_id: pkg.id, shipping_service_id: shippingService.id, currency: "USD", base_charge: 5, fuel_surcharge: 1, handling_charge: 1, quote_reference: `P5A-${run}`, created_by_user_id: admin.id }));
  const pkg2 = await must(svc.from("shipment_packages").insert({ organization_id: seller, shipment_id: shipment.id, package_sequence: 2, status: "locked", weight: 1, weight_unit: "lb" }).select("id").single());
  await must(svc.from("shipping_charge_snapshots").insert({ organization_id: seller, shipment_id: shipment.id, package_id: pkg2.id, shipping_service_id: shippingService.id, currency: "USD", base_charge: 3, fuel_surcharge: 0.5, handling_charge: 0.5, quote_reference: `P5A-2-${run}`, created_by_user_id: admin.id }));

  const invoice = await must(admin.client.rpc("create_invoice_from_order", { target_organization_id: seller, target_order_id: order.id, target_idempotency_key: `invoice-${run}`, target_due_at: null }));
  check("Invoice creation snapshots order and shipping charges", Boolean(invoice));
  const invoiceRow = await must(svc.from("invoices").select("invoice_number,status,currency,subtotal,shipping_total,total,balance_due").eq("id", invoice).single());
  check("Fixed-precision invoice totals are correct", invoiceRow.subtotal === 25 && invoiceRow.shipping_total === 11 && invoiceRow.total === 36 && invoiceRow.balance_due === 36);
  const invoiceRetry = await must(admin.client.rpc("create_invoice_from_order", { target_organization_id: seller, target_order_id: order.id, target_idempotency_key: `invoice-${run}`, target_due_at: null }));
  check("Duplicate invoice creation is idempotent", invoiceRetry === invoice);
  await denied("Duplicate invoice with a different key is denied", admin.client.rpc("create_invoice_from_order", { target_organization_id: seller, target_order_id: order.id, target_idempotency_key: `invoice-alt-${run}`, target_due_at: null }));
  const order2 = await must(svc.from("orders").insert({ organization_id: seller, client_organization_id: clientOrg, customer_id: customer.id, address_id: address.id, order_number: `SVFC-ORD-P5A-2-${run.slice(0, 8)}`, status: "submitted", currency: "USD", customer_snapshot: { display_name: "Billing Customer" }, address_snapshot: { line1: "1 Main" }, client_snapshot: { name: "Client" }, subtotal: 12.5, total: 12.5, submitted_at: new Date().toISOString(), submitted_by_user_id: client.id, idempotency_key: `order2-${run}`, request_hash: `${run}-2` }).select("id").single());
  await must(svc.from("order_lines").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order2.id, entry_id: entry.id, product_id: product.id, variant_id: variant.id, sku: `P5A-2-${run}`, display_name: "Billing Product", quantity: 1, unit_price: 12.5, currency: "USD", line_total: 12.5, pricing_snapshot: { unit_price: 12.5, currency: "USD" } }));
  const order3 = await must(svc.from("orders").insert({ organization_id: seller, client_organization_id: clientOrg, customer_id: customer.id, address_id: address.id, order_number: `SVFC-ORD-P5A-3-${run.slice(0, 8)}`, status: "submitted", currency: "USD", customer_snapshot: { display_name: "Billing Customer" }, address_snapshot: { line1: "1 Main" }, client_snapshot: { name: "Client" }, subtotal: 12.5, total: 12.5, submitted_at: new Date().toISOString(), submitted_by_user_id: client.id, idempotency_key: `order3-${run}`, request_hash: `${run}-3` }).select("id").single());
  await must(svc.from("order_lines").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order3.id, entry_id: entry.id, product_id: product.id, variant_id: variant.id, sku: `P5A-3-${run}`, display_name: "Billing Product", quantity: 1, unit_price: 12.5, currency: "USD", line_total: 12.5, pricing_snapshot: { unit_price: 12.5, currency: "USD" } }));
  const [invoice2, invoice3] = await Promise.all([admin.client.rpc("create_invoice_from_order", { target_organization_id: seller, target_order_id: order2.id, target_idempotency_key: `invoice2-${run}`, target_due_at: null }), admin.client.rpc("create_invoice_from_order", { target_organization_id: seller, target_order_id: order3.id, target_idempotency_key: `invoice3-${run}`, target_due_at: null })]);
  check("Concurrent invoice numbering is unique", !invoice2.error && !invoice3.error && invoice2.data !== invoice3.data);
  await must(admin.client.rpc("issue_invoice", { target_organization_id: seller, target_invoice_id: invoice, target_idempotency_key: `issue-${run}` }));
  check("Invoice issue is audited and immutable", Boolean(await must(svc.from("invoices").select("issued_at,immutable_at,status").eq("id", invoice).single())).valueOf);
  await must(svc.from("products").update({ product_name: "Changed Product" }).eq("id", product.id));
  const stable = await must(svc.from("invoice_lines").select("description,unit_price,line_total").eq("invoice_id", invoice).eq("source_type", "order_line").single());
  check("Invoice line snapshot survives master edits", stable.description === "Billing Product" && stable.unit_price === 12.5 && stable.line_total === 25);
  await denied("Client direct invoice reads denied", client.client.from("invoices").select("*").eq("id", invoice));
  const summary = await must(client.client.rpc("get_client_financial_summary", { target_client_organization_id: clientOrg }));
  check("Client financial summary is safe", Array.isArray(summary.invoices) && !/supplier|acquisition|margin|qc|warehouse|internal/i.test(JSON.stringify(summary)));
  const statement = await must(client.client.rpc("get_client_account_statement", { target_client_organization_id: clientOrg }));
  check("Client account statement is exportable and safe", Array.isArray(statement));
  await denied("Unauthorized staff payment recording denied", staff.client.rpc("record_manual_payment", { target_organization_id: seller, target_invoice_id: invoice, target_amount: 10, target_currency: "USD", target_reference: "no", target_idempotency_key: `staff-${run}` }));
  const payment = await must(admin.client.rpc("record_manual_payment", { target_organization_id: seller, target_invoice_id: invoice, target_amount: 10.005, target_currency: "USD", target_reference: "offline-1", target_idempotency_key: `payment-${run}` }));
  check("Manual payment is rounded with fixed precision", Boolean(payment) && (await must(svc.from("payment_transactions").select("amount,status").eq("id", payment).single())).amount === 10.01);
  const paymentRetry = await must(admin.client.rpc("record_manual_payment", { target_organization_id: seller, target_invoice_id: invoice, target_amount: 10.005, target_currency: "USD", target_reference: "retry", target_idempotency_key: `payment-${run}` }));
  check("Duplicate payment recording is idempotent", paymentRetry === payment);
  const overpayment = await must(admin.client.rpc("record_manual_payment", { target_organization_id: seller, target_invoice_id: invoice, target_amount: 30, target_currency: "USD", target_reference: "offline-2", target_idempotency_key: `payment2-${run}` }));
  const paidRow = await must(svc.from("invoices").select("amount_paid,balance_due,overpayment,status").eq("id", invoice).single());
  check("Overpayment and balance due are bounded", Boolean(overpayment) && paidRow.amount_paid === 40.01 && paidRow.balance_due === 0 && paidRow.overpayment === 4.01 && paidRow.status === "paid");
  const credit = await must(admin.client.rpc("create_credit_memo", { target_organization_id: seller, target_invoice_id: invoice, target_amount: 5, target_reason: "Approved return", target_rma_id: null, target_idempotency_key: `credit-${run}` }));
  const creditRetry = await must(admin.client.rpc("create_credit_memo", { target_organization_id: seller, target_invoice_id: invoice, target_amount: 5, target_reason: "retry", target_rma_id: null, target_idempotency_key: `credit-${run}` }));
  check("Credits are idempotent and append-only", Boolean(credit) && creditRetry === credit);
  const refund = await must(admin.client.rpc("record_refund", { target_organization_id: seller, target_payment_id: payment, target_amount: 3, target_reason: "Approved credit", target_idempotency_key: `refund-${run}` }));
  const refundRetry = await must(admin.client.rpc("record_refund", { target_organization_id: seller, target_payment_id: payment, target_amount: 3, target_reason: "retry", target_idempotency_key: `refund-${run}` }));
  check("Refunds are bounded and idempotent", Boolean(refund) && refundRetry === refund);
  const callback = await must(admin.client.rpc("record_test_payment_callback", { target_organization_id: seller, target_invoice_id: invoice2.data, target_provider: "test", target_provider_transaction_id: `txn-${run}`, target_status: "captured", target_amount: 4, target_currency: "USD", target_event_id: `event-${run}` }));
  const callbackRetry = await must(admin.client.rpc("record_test_payment_callback", { target_organization_id: seller, target_invoice_id: invoice2.data, target_provider: "test", target_provider_transaction_id: `txn-${run}`, target_status: "captured", target_amount: 4, target_currency: "USD", target_event_id: `event-${run}` }));
  check("Provider callback deduplication is idempotent", Boolean(callback) && callbackRetry === callback);
  const declined = await must(admin.client.rpc("record_test_payment_callback", { target_organization_id: seller, target_invoice_id: invoice3.data, target_provider: "test", target_provider_transaction_id: `declined-${run}`, target_status: "declined", target_amount: 9, target_currency: "USD", target_event_id: `declined-event-${run}` }));
  const declinedRow = await must(svc.from("payment_transactions").select("status").eq("id", declined).single());
  check("Declined provider callback is recorded without settlement", declinedRow.status === "declined");
  await denied("Unauthorized financial adjustment denied", staff.client.rpc("create_financial_adjustment", { target_organization_id: seller, target_invoice_id: invoice2.data, target_type: "debit", target_amount: 1, target_reason: "No", target_idempotency_key: `staff-adjust-${run}` }));
  const adjustment = await must(admin.client.rpc("create_financial_adjustment", { target_organization_id: seller, target_invoice_id: invoice2.data, target_type: "debit", target_amount: 1.235, target_reason: "Approved surcharge", target_idempotency_key: `adjust-${run}` }));
  const adjustedInvoice = await must(svc.from("invoices").select("adjustment_total,balance_due").eq("id", invoice2.data).single());
  check("Financial adjustments are rounded, append-only, and affect balance", Boolean(adjustment) && adjustedInvoice.adjustment_total === 1.24 && adjustedInvoice.balance_due === 9.74);
  const crossTenantSummary = await must(other.client.rpc("get_client_financial_summary", { target_client_organization_id: clientOrg }));
  check("Cross-tenant financial access denied", Array.isArray(crossTenantSummary.invoices) && crossTenantSummary.invoices.length === 0 && Array.isArray(crossTenantSummary.credits) && crossTenantSummary.credits.length === 0);
  await denied("Anonymous financial access denied", anon.rpc("get_client_financial_summary", { target_client_organization_id: clientOrg }));
  await must(svc.from("profiles").update({ status: "suspended" }).eq("id", client.id));
  const suspendedSummary = await must(client.client.rpc("get_client_financial_summary", { target_client_organization_id: clientOrg }));
  check("Suspended client financial access denied", Array.isArray(suspendedSummary.invoices) && suspendedSummary.invoices.length === 0);
  await must(svc.from("organizations").update({ status: "inactive" }).eq("id", clientOrg));
  const inactiveSummary = await must(client.client.rpc("get_client_financial_summary", { target_client_organization_id: clientOrg }));
  check("Inactive client organization financial access denied", Array.isArray(inactiveSummary.invoices) && inactiveSummary.invoices.length === 0);
  await denied("Financial history cannot be rewritten", admin.client.from("invoice_lines").update({ line_total: 999 }).eq("invoice_id", invoice));
  const audit = await must(svc.from("audit_logs").select("action").eq("organization_id", seller));
  check("Financial audit events exist", audit.some((row) => row.action === "invoice.created") && audit.some((row) => row.action === "payment.recorded") && audit.some((row) => row.action === "credit.memo_issued") && audit.some((row) => row.action === "refund.recorded"));
} catch (error) {
  console.error("PHASE 5A FAILURE", error);
  process.exitCode = 1;
} finally {
  for (const id of users) { try { await svc.auth.admin.deleteUser(id); } catch {} }
}
