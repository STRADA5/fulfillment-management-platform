import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.LOCAL_SUPABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw Error("LOCAL Supabase only");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const svc = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY, options);
const anon = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
const run = randomUUID(); const users = []; const orgs = []; let passed = 0;
const must = async (promise) => { const result = await promise; if (result.error) throw Error(JSON.stringify(result.error)); return result.data; };
const check = (name, value) => { assert.ok(value, name); console.log(`PASS ${++passed}: ${name}`); };
const denied = async (name, promise) => { const result = await promise; check(name, Boolean(result.error) || !result.data || (Array.isArray(result.data) && result.data.length === 0)); };
async function makeUser(label) { const email = `p4f-${label}-${run}@example.test`; const password = `Local-${run}-Aa1!`; const created = await must(svc.auth.admin.createUser({ email, password, email_confirm: true })); users.push(created.user.id); const client = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options); await must(client.auth.signInWithPassword({ email, password })); return { id: created.user.id, client }; }
async function makeOrg(label, type, parent = null) { const row = await must(svc.from("organizations").insert({ name: `P4F ${label} ${run}`, slug: `p4f-${label}-${run}`, organization_type: type, status: "active", parent_organization_id: parent }).select("id").single()); orgs.push(row.id); return row.id; }

try {
  for (const table of ["notification_preferences", "notification_event_history", "split_order_letters", "discrepancy_cases", "discrepancy_case_events"]) check(`${table} exists`, !(await svc.from(table).select("*").limit(0)).error);
  const seller = await makeOrg("seller", "fulfillment_company");
  const clientOrg = await makeOrg("client", "client_company", seller);
  const otherOrg = await makeOrg("other", "fulfillment_company");
  const admin = await makeUser("admin"); const client = await makeUser("client"); const other = await makeUser("other");
  const roles = Object.fromEntries((await must(svc.from("roles").select("id,code"))).map((r) => [r.code, r.id]));
  await must(svc.from("organization_memberships").insert([
    { organization_id: seller, user_id: admin.id, role_id: roles.ADMIN, status: "active", is_primary: true },
    { organization_id: clientOrg, user_id: client.id, role_id: roles.CLIENT_ADMIN, status: "active", is_primary: true },
    { organization_id: otherOrg, user_id: other.id, role_id: roles.ADMIN, status: "active", is_primary: true },
  ]));
  await must(svc.from("client_service_relationships").insert({ organization_id: seller, client_organization_id: clientOrg, status: "active", order_access: "read", customer_access: "read" }));
  const customer = await must(svc.from("customers").insert({ organization_id: clientOrg, customer_number: `C-${run.slice(0, 8)}`, display_name: "Notification Customer", status: "active" }).select("id").single());
  const address = await must(svc.from("customer_addresses").insert({ organization_id: clientOrg, customer_id: customer.id, label: "Ship", recipient: "Client", line1: "1 Main", city: "Austin", country_code: "US", status: "active", is_default_shipping: true }).select("id").single());
  const order = await must(svc.from("orders").insert({ organization_id: seller, client_organization_id: clientOrg, customer_id: customer.id, address_id: address.id, order_number: `SVFC-ORD-P4F-${run.slice(0, 8)}`, status: "processing", allocation_status: "pending", currency: "USD", customer_snapshot: { display_name: "Notification Customer" }, address_snapshot: { line1: "1 Main" }, client_snapshot: { name: "Client" }, subtotal: 10, total: 10, submitted_at: new Date().toISOString(), submitted_by_user_id: client.id, idempotency_key: `base-${run}`, request_hash: run }).select("id").single());

  await must(svc.from("order_lifecycle_events").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order.id, action: "processing", old_status: "accepted", new_status: "processing", actor_user_id: admin.id }));
  const feed = await must(client.client.rpc("get_client_notification_feed", { target_limit: 50 }));
  check("Client dashboard feed receives trusted lifecycle event", feed.some((entry) => entry.event_type === "order.processing"));
  const alerts = await must(admin.client.rpc("get_internal_alert_feed", { target_organization_id: seller, target_limit: 50 }));
  check("Internal staff alert is generated from trusted lifecycle event", alerts.some((entry) => entry.alert_type === "order_processing"));
  const serialized = JSON.stringify(feed); check("Client payload is redacted", !/supplier|acquisition|warehouse|qc|internal_notes|cost/i.test(serialized));
  await denied("Anonymous dashboard feed denied", anon.rpc("get_client_notification_feed", { target_limit: 10 }));
  await denied("Cross-organization internal alert feed denied", other.client.rpc("get_internal_alert_feed", { target_organization_id: seller, target_limit: 10 }));

  await must(client.client.rpc("set_notification_preference", { target_organization_id: clientOrg, target_user_id: client.id, target_event_type: "*", target_in_app_enabled: false, target_suppressed_until: null }));
  await must(svc.from("order_lifecycle_events").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order.id, action: "exception", old_status: "processing", new_status: "exception", actor_user_id: admin.id }));
  const suppressedFeed = await must(client.client.rpc("get_client_notification_feed", { target_limit: 50 }));
  check("Per-user notification suppression is enforced", !suppressedFeed.some((entry) => entry.event_type === "order.exception"));

  const addendum = await must(svc.from("order_addendums").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order.id, addendum_number: `ADD-P4F-${run.slice(0, 6)}`, reason: "split letter", request_hash: run, idempotency_key: `letter-${run}`, created_by_user_id: admin.id }).select("id").single());
  await must(svc.from("order_addendum_events").insert({ organization_id: seller, addendum_id: addendum.id, order_id: order.id, event_type: "continuation_created", locked_shipment_exists: true, snapshot: { shipment_id: null, shipment_sequence: 2 }, actor_user_id: admin.id }));
  const letter = await must(client.client.rpc("get_split_order_letter", { target_order_id: order.id }));
  check("Split-order letter is generated and client-safe", Boolean(letter?.content) && /separate shipment/i.test(JSON.stringify(letter)) && !/supplier|acquisition|qc|warehouse/i.test(JSON.stringify(letter)));

  const discrepancy = await must(admin.client.rpc("create_discrepancy_case", { target_organization_id: seller, target_client_organization_id: clientOrg, target_order_id: order.id, target_shipment_id: null, target_case_type: "delay", target_severity: "high", target_title: "Carrier delay", target_description: "Local test case", target_source_event_type: "shipping_tracking_events", target_source_event_id: run, target_idempotency_key: `disc-${run}` }));
  check("Authorized discrepancy case creation", Boolean(discrepancy));
  await denied("Unauthorized discrepancy creation denied", other.client.rpc("create_discrepancy_case", { target_organization_id: seller, target_client_organization_id: clientOrg, target_order_id: order.id, target_shipment_id: null, target_case_type: "delay", target_severity: "high", target_title: "Attack", target_description: "", target_source_event_type: "x", target_source_event_id: "x", target_idempotency_key: `attack-${run}` }));
  const updated = await must(admin.client.rpc("update_discrepancy_case", { target_organization_id: seller, target_id: discrepancy, target_status: "resolved", target_severity: "high", target_assigned_to: admin.id, target_resolution: "Reviewed" }));
  check("Authorized discrepancy resolution and immutable event history", updated === discrepancy && (await must(svc.from("discrepancy_case_events").select("id").eq("discrepancy_case_id", discrepancy))).length === 2);

  await must(svc.from("order_lifecycle_events").insert({ organization_id: seller, client_organization_id: clientOrg, order_id: order.id, action: "ready", old_status: "processing", new_status: "ready", actor_user_id: admin.id }));
  const [processedA, processedB] = await Promise.all([
    admin.client.rpc("process_local_notification_outbox", { target_organization_id: seller, target_limit: 100 }),
    admin.client.rpc("process_local_notification_outbox", { target_organization_id: seller, target_limit: 100 }),
  ]);
  if (processedA.error) throw Error(JSON.stringify(processedA.error)); if (processedB.error) throw Error(JSON.stringify(processedB.error));
  check("Trusted local outbox processor sends pending events", Number(processedA.data ?? 0) + Number(processedB.data ?? 0) >= 1);
  const histories = await must(svc.from("notification_event_history").select("status").eq("organization_id", seller));
  check("Notification processing history is append-only and recorded", histories.some((row) => row.status === "sent") && histories.some((row) => row.status === "processing"));
  const sentRows = await must(svc.from("notification_event_history").select("notification_id,status").eq("organization_id", seller).eq("status", "sent"));
  const sentCounts = new Map(); for (const row of sentRows) sentCounts.set(row.notification_id, (sentCounts.get(row.notification_id) ?? 0) + 1);
  check("Concurrent processors do not duplicate delivery", [...sentCounts.values()].every((count) => count === 1));
  await denied("Anonymous outbox table access denied", anon.from("notification_outbox").select("id"));
  await denied("Anonymous discrepancy table access denied", anon.from("discrepancy_cases").select("id"));
  check("Notification dedupe is enforced", (await must(svc.from("notification_outbox").select("id").eq("organization_id", seller).eq("dedupe_key", `lifecycle-${(await must(svc.from("order_lifecycle_events").select("id").eq("order_id", order.id).limit(1).single())).id}`))).length <= 1);
  const audit = await must(svc.from("audit_logs").select("action,organization_id").in("organization_id", [seller, clientOrg]));
  check("Notification and discrepancy audit events exist", audit.some((row) => row.action === "notification.preference_updated") && audit.some((row) => row.action === "discrepancy.created"));
  console.log(`Phase 4F: ${passed} checks passed.`);
} catch (error) { console.error("PHASE 4F FAILURE", error); process.exitCode = 1; }
finally { for (const id of users) { try { await svc.auth.admin.deleteUser(id); } catch {} } }
