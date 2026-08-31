import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.LOCAL_SUPABASE_URL;
if (!url || new URL(url).hostname !== "127.0.0.1") throw Error("LOCAL Supabase only");
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(url, process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY, options);
const run = randomUUID();
const users = [];
const organizations = [];
let passed = 0;
const must = async (promise) => { const result = await promise; if (result.error) throw Error(JSON.stringify(result.error)); return result.data; };
const check = (name, condition) => { assert.ok(condition, name); console.log(`PASS ${++passed}: ${name}`); };
const denied = async (name, promise) => { const result = await promise; check(name, Boolean(result.error) || !result.data || (Array.isArray(result.data) && result.data.length === 0)); };
async function createUser(label) {
  const email = `p5d-${label}-${run}@example.test`, password = `Local-${run}-Aa1!`;
  const result = await must(service.auth.admin.createUser({ email, password, email_confirm: true }));
  users.push(result.user.id);
  const client = createClient(url, process.env.LOCAL_SUPABASE_ANON_KEY, options);
  await must(client.auth.signInWithPassword({ email, password }));
  return { id: result.user.id, client };
}
async function createOrganization(label, type, parent = null) {
  const row = await must(service.from("organizations").insert({ name: `P5D ${label} ${run}`, slug: `p5d-${label}-${run}`, organization_type: type, status: "active", parent_organization_id: parent }).select("id").single());
  organizations.push(row.id);
  return row.id;
}

try {
  const provider = await createOrganization("provider", "fulfillment_company");
  const clientOrg = await createOrganization("client", "client_company", provider);
  const otherProvider = await createOrganization("other", "fulfillment_company");
  const admin = await createUser("admin");
  const salesperson = await createUser("salesperson");
  const clientUser = await createUser("client");
  const otherAdmin = await createUser("other-admin");
  const roles = Object.fromEntries((await must(service.from("roles").select("id,code"))).map((row) => [row.code, row.id]));
  await must(service.from("organization_memberships").insert([
    { organization_id: provider, user_id: admin.id, role_id: roles.ADMIN, status: "active", is_primary: true },
    { organization_id: provider, user_id: salesperson.id, role_id: roles.STAFF, status: "active", is_primary: false },
    { organization_id: clientOrg, user_id: clientUser.id, role_id: roles.CLIENT_ADMIN, status: "active", is_primary: true },
    { organization_id: otherProvider, user_id: otherAdmin.id, role_id: roles.ADMIN, status: "active", is_primary: true },
  ]));
  await must(service.from("client_service_relationships").insert({ organization_id: provider, client_organization_id: clientOrg, status: "active", customer_access: "read", order_access: "manage" }));

  const sections = await must(service.from("knowledge_library_sections").select("id,code").is("organization_id", null));
  const protocols = sections.find((row) => row.code === "protocols");
  const research = sections.find((row) => row.code === "research");
  check("Global protocol and research sections exist", Boolean(protocols && research));
  const category = await must(admin.client.rpc("admin_save_library_category", { target_id: null, target_organization_id: provider, target_section_id: protocols.id, target_parent_category_id: null, target_name: "Operations", target_slug: `operations-${run.slice(0, 8)}`, target_description: "", target_status: "active", target_display_order: 10, target_expected_version: null }));
  const tag = await must(admin.client.rpc("admin_save_library_tag", { target_id: null, target_organization_id: provider, target_name: "Onboarding", target_slug: `onboarding-${run.slice(0, 8)}` }));
  const navigation = await must(admin.client.rpc("get_library_navigation", { target_provider_id: provider }));
  check("Provider navigation supports categories and tags", navigation.categories.some((row) => row.id === category) && navigation.tags.some((row) => row.id === tag));
  await denied("Unrelated provider cannot read provider navigation", otherAdmin.client.rpc("get_library_navigation", { target_provider_id: provider }));

  const protocol = await must(admin.client.rpc("admin_save_library_item", { target_id: null, target_organization_id: provider, target_section_id: protocols.id, target_category_id: category, target_item_type: "protocol", target_slug: `p5d-protocol-${run.slice(0, 8)}`, target_title: "Approved fulfillment protocol", target_summary: "Client-safe fulfillment guidance.", target_body: "Follow the approved workflow.", target_document_metadata: { file_name: "protocol.txt", mime_type: "text/plain", internal_secret: "do-not-share" }, target_source_metadata: { citation: "P5D source", internal_secret: "private-source", title: "Public citation", url: "https://example.test/source" }, target_visibility: "client_safe", target_client_safe: true, target_expected_version: null }));
  await must(admin.client.rpc("admin_set_library_item_tags", { target_organization_id: provider, target_item_id: protocol, target_tag_ids: [tag] }));
  const protocolVersion = (await must(service.from("knowledge_library_item_versions").select("id,version_number,status").eq("item_id", protocol).single()));
  check("Library item starts as a versioned draft", protocolVersion.version_number === 1 && protocolVersion.status === "draft");
  await must(admin.client.rpc("transition_library_version", { target_version_id: protocolVersion.id, target_status: "review" }));
  await denied("Salesperson cannot approve library content", salesperson.client.rpc("transition_library_version", { target_version_id: protocolVersion.id, target_status: "approved" }));
  await must(admin.client.rpc("transition_library_version", { target_version_id: protocolVersion.id, target_status: "approved" }));
  await must(admin.client.rpc("transition_library_version", { target_version_id: protocolVersion.id, target_status: "published" }));
  const published = await must(service.from("knowledge_library_item_versions").select("id,status,client_safe").eq("id", protocolVersion.id).single());
  check("Approval and publishing lifecycle is enforced", published.status === "published" && published.client_safe === true);

  const newer = await must(admin.client.rpc("admin_save_library_item", { target_id: protocol, target_organization_id: provider, target_section_id: protocols.id, target_category_id: category, target_item_type: "protocol", target_slug: `p5d-protocol-${run.slice(0, 8)}`, target_title: "Approved fulfillment protocol v2", target_summary: "Updated summary.", target_body: "Updated approved workflow.", target_document_metadata: {}, target_source_metadata: {}, target_visibility: "client_safe", target_client_safe: true, target_expected_version: null }));
  const versions = await must(service.from("knowledge_library_item_versions").select("version_number,status").eq("item_id", protocol).order("version_number"));
  check("Published history remains immutable when a new draft is created", newer === protocol && versions.length === 2 && versions[0].status === "published" && versions[1].status === "draft");
  await must(admin.client.rpc("admin_share_library_item", { target_provider_id: provider, target_item_id: protocol, target_version_id: protocolVersion.id, target_client_organization_id: clientOrg, target_effective_from: new Date(Date.now() - 1000).toISOString(), target_effective_to: null }));
  const clientLibrary = await must(clientUser.client.rpc("get_client_library", { target_provider_id: provider }));
  check("Client sees only explicitly shared client-safe content", clientLibrary.length === 1 && clientLibrary[0].item_id === protocol);
  const clientDelivery = await must(clientUser.client.rpc("get_library_item_delivery", { target_provider_id: provider, target_item_id: protocol, target_version_id: protocolVersion.id, target_mode: "download" }));
  check("Client delivery redacts internal document and source metadata", !clientDelivery.document_metadata.internal_secret && !clientDelivery.source_metadata.internal_secret && clientDelivery.source_metadata.citation === "P5D source");
  await denied("Client cannot read provider-owned library tables directly", clientUser.client.from("knowledge_library_item_versions").select("*") );
  await denied("Unrelated provider cannot deliver shared material", otherAdmin.client.rpc("get_library_item_delivery", { target_provider_id: provider, target_item_id: protocol, target_version_id: protocolVersion.id, target_mode: "download" }));
  const providerDelivery = await must(admin.client.rpc("get_library_item_delivery", { target_provider_id: provider, target_item_id: protocol, target_version_id: protocolVersion.id, target_mode: "print" }));
  check("Provider print delivery succeeds and preserves full metadata", providerDelivery.document_metadata.internal_secret === "do-not-share");

  const plugin = await must(admin.client.rpc("admin_save_calculator_plugin", { target_id: null, target_provider_id: provider, target_slug: `p5d-calculator-${run.slice(0, 8)}`, target_name: "External calculator shell", target_description: "Metadata-only plugin registration.", target_plugin_kind: "external", target_status: "active" }));
  const pluginVersion = await must(admin.client.rpc("admin_save_calculator_version", { target_id: null, target_provider_id: provider, target_plugin_id: plugin, target_version: "1.0.0", target_manifest: { entry: "external://calculator" }, target_input_schema: { concentration: { type: "number", unit: "mg_per_ml" } }, target_output_schema: { volume: { type: "number", unit: "ml" } }, target_unit_schema: { concentration: ["mg_per_ml"], volume: ["ml"] }, target_engine_reference: "external://calculator", target_dosing_mode: "reference_only", target_checksum: "local-checksum" }));
  await must(admin.client.rpc("transition_calculator_version", { target_version_id: pluginVersion, target_status: "review" }));
  await must(admin.client.rpc("transition_calculator_version", { target_version_id: pluginVersion, target_status: "approved" }));
  await must(admin.client.rpc("transition_calculator_version", { target_version_id: pluginVersion, target_status: "published" }));
  await must(admin.client.rpc("admin_link_calculator_source", { target_provider_id: provider, target_plugin_version_id: pluginVersion, target_library_item_id: protocol, target_library_version_id: protocolVersion.id, target_relationship_type: "approved_protocol" }));
  await denied("Calculator dosing authority cannot be prescribed", admin.client.rpc("admin_save_calculator_version", { target_id: null, target_provider_id: provider, target_plugin_id: plugin, target_version: "2.0.0", target_manifest: {}, target_input_schema: {}, target_output_schema: {}, target_unit_schema: {}, target_engine_reference: "", target_dosing_mode: "prescribe", target_checksum: "" }));
  const context = await must(admin.client.rpc("get_library_context", { target_provider_id: provider, target_query: "onboarding" }));
  check("Published calculator metadata is exposed without execution", context.calculators.some((row) => row.version_id === pluginVersion) && context.items.some((row) => row.id === protocol));
  const personal = await must(salesperson.client.rpc("save_personal_calculator_configuration", { target_id: null, target_provider_id: provider, target_plugin_version_id: pluginVersion, target_name: "My concentration template", target_configuration: { preferred_unit: "ml" }, target_status: "active", target_expected_version: null }));
  const personalRows = await must(salesperson.client.rpc("get_personal_calculator_configurations", { target_provider_id: provider }));
  check("Salesperson personal configuration is owner-scoped", personalRows.length === 1 && personalRows[0].id === personal);
  const adminPersonal = await must(admin.client.rpc("get_personal_calculator_configurations", { target_provider_id: provider }));
  check("Another provider user cannot read salesperson personal configuration", adminPersonal.length === 0);
  await denied("Client cannot read calculator plugin tables directly", clientUser.client.from("calculator_plugin_versions").select("*"));
  const audits = await must(service.from("audit_logs").select("action").eq("organization_id", provider));
  check("Library, delivery, calculator, and personal actions are audited", ["library.item_created", "library.version_approved", "library.download", "calculator.version_published", "calculator.personal_created"].every((action) => audits.some((row) => row.action === action)));
  console.log(`Phase 5D: ${passed} checks passed.`);
} catch (error) {
  console.error("PHASE 5D FAILURE", error);
  process.exitCode = 1;
} finally {
  try {
    await service.from("knowledge_library_items").update({ current_version_id: null }).in("organization_id", organizations);
    for (const table of ["calculator_configuration_events", "calculator_personal_configurations", "calculator_plugin_source_links", "calculator_plugin_versions", "calculator_plugins", "knowledge_library_delivery_events", "knowledge_library_share_grants", "knowledge_library_version_events", "knowledge_library_item_tags", "knowledge_library_item_versions", "knowledge_library_items", "knowledge_library_tags", "knowledge_library_categories"]) await service.from(table).delete().in("organization_id", organizations);
    for (const id of organizations.slice().reverse()) await service.from("organizations").delete().eq("id", id);
    for (const id of users) await service.auth.admin.deleteUser(id);
  } catch (error) { console.error("LOCAL cleanup failure", error); process.exitCode = 1; }
}
