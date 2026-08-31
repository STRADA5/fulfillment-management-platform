"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type LibraryActionState = { error?: string; success?: string };
const raw = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const text = (form: FormData, name: string, max = 10000, required = false) => {
  const value = raw(form, name);
  if ((required && !value) || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
};
const uuid = (form: FormData, name: string, optional = false) => {
  const value = raw(form, name);
  if (!value && optional) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
};
const integer = (form: FormData, name: string, fallback = 0) => {
  const value = raw(form, name);
  if (!value) return fallback;
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new Error(`Invalid ${name}.`);
  return result;
};
const json = (form: FormData, name: string) => {
  const value = raw(form, name);
  if (!value) return {};
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(`Invalid ${name}.`);
  return parsed;
};
const date = (form: FormData, name: string) => {
  const value = raw(form, name);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid ${name}.`);
  return parsed.toISOString();
};

async function provider(permission: string) {
  const context = await getAppContext();
  if (!context.membership || !context.membership.permissions.includes(permission)) throw new Error("Not authorized.");
  return context.membership.organizationId;
}

async function call(name: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.code === "23505" ? "That value already exists." : error.message || "The change could not be saved.");
  revalidatePath("/library");
  revalidatePath("/dashboard");
  revalidatePath("/fulfillment");
  revalidatePath("/salespeople");
  revalidatePath("/administration/audit-log");
  return { success: "Saved and audited." };
}

export async function saveLibrarySection(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("library.categories.manage"); return await call("admin_save_library_section", { target_id: uuid(form, "id", true), target_organization_id: organization, target_code: text(form, "code", 80, true), target_name: text(form, "name", 160, true), target_description: text(form, "description"), target_section_type: text(form, "sectionType", 30, true), target_status: text(form, "status", 20, true), target_display_order: integer(form, "displayOrder", 100), target_expected_version: null }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save section." }; }
}

export async function saveLibraryCategory(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("library.categories.manage"); return await call("admin_save_library_category", { target_id: uuid(form, "id", true), target_organization_id: organization, target_section_id: uuid(form, "sectionId"), target_parent_category_id: uuid(form, "parentCategoryId", true), target_name: text(form, "name", 160, true), target_slug: text(form, "slug", 80, true), target_description: text(form, "description"), target_status: text(form, "status", 20, true), target_display_order: integer(form, "displayOrder", 100), target_expected_version: null }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save category." }; }
}

export async function saveLibraryTag(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("library.categories.manage"); return await call("admin_save_library_tag", { target_id: uuid(form, "id", true), target_organization_id: organization, target_name: text(form, "name", 80, true), target_slug: text(form, "slug", 80, true) }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save tag." }; }
}

export async function saveLibraryItem(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try {
    const organization = await provider(raw(form, "id") ? "library.edit" : "library.create");
    const itemId = uuid(form, "id", true);
    const slug = text(form, "slug", 80, true);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid slug.");
    return await call("admin_save_library_item", { target_id: itemId, target_organization_id: organization, target_section_id: uuid(form, "sectionId"), target_category_id: uuid(form, "categoryId", true), target_item_type: text(form, "itemType", 20, true), target_slug: slug, target_title: text(form, "title", 240, true), target_summary: text(form, "summary", 5000), target_body: text(form, "body", 100000), target_document_metadata: json(form, "documentMetadata"), target_source_metadata: json(form, "sourceMetadata"), target_visibility: text(form, "visibility", 30, true), target_client_safe: form.get("clientSafe") === "on", target_expected_version: null });
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save library item." }; }
}

export async function setLibraryItemTags(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("library.edit"); const ids = raw(form, "tagIds").split(",").map((value) => value.trim()).filter(Boolean); if (ids.some((value) => !/^[0-9a-f-]{36}$/i.test(value))) throw new Error("Invalid tag list."); return await call("admin_set_library_item_tags", { target_organization_id: organization, target_item_id: uuid(form, "itemId"), target_tag_ids: ids }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to set tags." }; }
}

export async function transitionLibraryVersion(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { await provider(raw(form, "status") === "approved" ? "library.approve" : raw(form, "status") === "published" || raw(form, "status") === "archived" ? "library.publish" : "library.edit"); return await call("transition_library_version", { target_version_id: uuid(form, "versionId"), target_status: text(form, "status", 20, true) }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to change lifecycle." }; }
}

export async function shareLibraryItem(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("library.share_client"); return await call("admin_share_library_item", { target_provider_id: organization, target_item_id: uuid(form, "itemId"), target_version_id: uuid(form, "versionId"), target_client_organization_id: uuid(form, "clientId"), target_effective_from: date(form, "effectiveFrom"), target_effective_to: date(form, "effectiveTo") }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to share item." }; }
}

export async function saveCalculatorPlugin(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("calculator.manage"); return await call("admin_save_calculator_plugin", { target_id: uuid(form, "id", true), target_provider_id: organization, target_slug: text(form, "slug", 80, true), target_name: text(form, "name", 160, true), target_description: text(form, "description"), target_plugin_kind: text(form, "pluginKind", 20, true), target_status: text(form, "status", 20, true) }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save calculator plugin." }; }
}

export async function saveCalculatorVersion(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("calculator.manage"); return await call("admin_save_calculator_version", { target_id: uuid(form, "id", true), target_provider_id: organization, target_plugin_id: uuid(form, "pluginId"), target_version: text(form, "version", 64, true), target_manifest: json(form, "manifest"), target_input_schema: json(form, "inputSchema"), target_output_schema: json(form, "outputSchema"), target_unit_schema: json(form, "unitSchema"), target_engine_reference: text(form, "engineReference", 500), target_dosing_mode: text(form, "dosingMode", 30, true), target_checksum: text(form, "checksum", 200) }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save calculator version." }; }
}

export async function transitionCalculatorVersion(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { await provider("calculator.manage"); return await call("transition_calculator_version", { target_version_id: uuid(form, "versionId"), target_status: text(form, "status", 20, true) }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to change calculator lifecycle." }; }
}

export async function linkCalculatorSource(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("calculator.manage"); return await call("admin_link_calculator_source", { target_provider_id: organization, target_plugin_version_id: uuid(form, "pluginVersionId"), target_library_item_id: uuid(form, "itemId"), target_library_version_id: uuid(form, "libraryVersionId"), target_relationship_type: text(form, "relationshipType", 30, true) }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to link source." }; }
}

export async function savePersonalCalculatorConfiguration(_: LibraryActionState, form: FormData): Promise<LibraryActionState> {
  try { const organization = await provider("calculator.personal"); return await call("save_personal_calculator_configuration", { target_id: uuid(form, "id", true), target_provider_id: organization, target_plugin_version_id: uuid(form, "pluginVersionId"), target_name: text(form, "name", 160, true), target_configuration: json(form, "configuration"), target_status: text(form, "status", 20, true), target_expected_version: null }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save personal configuration." }; }
}
