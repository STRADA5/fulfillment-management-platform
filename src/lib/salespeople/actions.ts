"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type SalespeopleActionState = { error?: string; success?: string };

const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const uuid = (form: FormData, name: string, optional = false) => {
  const raw = value(form, name);
  if (optional && !raw) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) throw new Error("Invalid identifier.");
  return raw;
};
const number = (form: FormData, name: string, fallback = 0) => {
  const raw = value(form, name);
  if (!raw && fallback !== 0) return fallback;
  const parsed = Number(raw || fallback);
  if (!Number.isFinite(parsed)) throw new Error("Invalid number.");
  return parsed;
};
const date = (form: FormData, name: string) => value(form, name) ? new Date(value(form, name)).toISOString() : null;

async function provider(permission: string) {
  const context = await getAppContext();
  if (!context.membership?.permissions.includes(permission)) throw new Error("Not authorized.");
  return context.membership.organizationId;
}

async function rpc(name: string, args: Record<string, unknown>, paths = ["/salespeople"]) {
  const supabase = await createClient();
  const { error } = await supabase.rpc(name as never, args as never);
  if (error) throw new Error(error.code === "23505" ? "That value conflicts with an existing record." : error.message || "The change could not be saved.");
  for (const path of paths) revalidatePath(path);
  revalidatePath("/administration/audit-log");
  return { success: "Saved successfully." };
}

export async function saveSalesperson(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { const organization = await provider("salespeople.manage"); return await rpc("admin_save_salesperson", { target_id: uuid(form, "id", true), target_provider_id: organization, target_user_id: uuid(form, "userId", true), target_code: value(form, "code").toUpperCase(), target_name: value(form, "name"), target_email: value(form, "email"), target_status: value(form, "status"), target_expected_version: form.get("version") ? number(form, "version") : null }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save." }; }
}

export async function assignClientSalesperson(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { const organization = await provider("salesperson.assign"); return await rpc("admin_assign_client_salesperson", { target_provider_id: organization, target_client_id: uuid(form, "clientId"), target_salesperson_id: uuid(form, "salespersonId"), target_effective_from: date(form, "effectiveFrom") ?? new Date().toISOString() }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save." }; }
}

export async function onboardClientWithSalesperson(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { const context = await getAppContext(); if (context.membership?.roleCode !== "SUPER_ADMIN") throw new Error("Active super-admin required."); const organization = uuid(form, "parentId"); const slug = value(form, "slug"); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid client slug."); return await rpc("admin_onboard_client_with_salesperson", { target_provider_id: organization, target_client_id: uuid(form, "id", true), target_name: value(form, "name"), target_slug: slug, target_email: value(form, "email"), target_phone: value(form, "phone"), target_status: value(form, "status"), target_salesperson_id: uuid(form, "salespersonId"), target_pricing_tier_id: uuid(form, "pricingTierId", true) }, ["/clients", "/salespeople", "/pricing-tiers"]); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to onboard client." }; }
}

export async function savePricingTier(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { const organization = await provider("pricing_tiers.manage"); return await rpc("admin_save_pricing_tier", { target_id: uuid(form, "id", true), target_provider_id: organization, target_code: value(form, "code").toUpperCase(), target_name: value(form, "name"), target_description: value(form, "description"), target_priority: number(form, "priority", 100), target_status: value(form, "status"), target_expected_version: form.get("version") ? number(form, "version") : null }, ["/pricing-tiers", "/salespeople"]); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save." }; }
}

export async function assignPricingTier(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { const organization = await provider("pricing_tiers.manage"); return await rpc("admin_assign_client_pricing_tier", { target_provider_id: organization, target_client_id: uuid(form, "clientId"), target_pricing_tier_id: uuid(form, "tierId"), target_effective_from: date(form, "effectiveFrom") ?? new Date().toISOString() }, ["/pricing-tiers", "/salespeople"]); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save." }; }
}

export async function savePricingTierPrice(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { const organization = await provider("pricing_tiers.manage"); return await rpc("admin_save_pricing_tier_price", { target_id: uuid(form, "id", true), target_provider_id: organization, target_pricing_tier_id: uuid(form, "tierId"), target_product_id: uuid(form, "productId"), target_variant_id: uuid(form, "variantId", true), target_currency: value(form, "currency").toUpperCase(), target_unit_price: number(form, "unitPrice"), target_minimum_quantity: number(form, "minimumQuantity", 1), target_maximum_quantity: value(form, "maximumQuantity") ? number(form, "maximumQuantity") : null, target_starts_at: date(form, "startsAt") ?? new Date().toISOString(), target_ends_at: date(form, "endsAt"), target_status: value(form, "status") }, ["/pricing-tiers"]); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save." }; }
}

export async function saveCommissionRule(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { const organization = await provider("commissions.manage"); return await rpc("admin_save_commission_rule", { target_id: uuid(form, "id", true), target_provider_id: organization, target_salesperson_id: uuid(form, "salespersonId"), target_client_id: uuid(form, "clientId", true), target_name: value(form, "name"), target_basis: value(form, "basis"), target_rate_type: value(form, "rateType"), target_rate: number(form, "rate"), target_currency: value(form, "currency").toUpperCase(), target_priority: number(form, "priority", 100), target_effective_from: date(form, "effectiveFrom") ?? new Date().toISOString(), target_effective_to: date(form, "effectiveTo"), target_status: value(form, "status"), target_expected_version: form.get("version") ? number(form, "version") : null }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save." }; }
}

export async function transitionCommission(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { await provider("commissions.manage"); return await rpc("transition_commission", { target_commission_id: uuid(form, "commissionId"), target_status: value(form, "status") }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to update." }; }
}

export async function createCommissionPayout(_: SalespeopleActionState, form: FormData): Promise<SalespeopleActionState> {
  try { const organization = await provider("payouts.manage"); const ids = value(form, "commissionIds").split(",").map((id) => id.trim()).filter(Boolean); return await rpc("admin_create_commission_payout", { target_provider_id: organization, target_salesperson_id: uuid(form, "salespersonId"), target_currency: value(form, "currency").toUpperCase(), target_commission_ids: ids, target_external_reference: value(form, "externalReference"), target_idempotency_key: value(form, "idempotencyKey") }); } catch (error) { return { error: error instanceof Error ? error.message : "Unable to create payout." }; }
}
