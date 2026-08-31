"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import type { FoundationState } from "@/lib/customers/actions";

const value = (f: FormData, key: string, max = 160) => {
  const result = String(f.get(key) ?? "").trim();
  if (result.length > max || /[\u0000-\u001f]/.test(result)) throw new Error(`Invalid ${key}.`);
  return result;
};
function uuid(f: FormData, key: string, optional: true): string | null;
function uuid(f: FormData, key: string, optional?: false): string;
function uuid(f: FormData, key: string, optional = false): string | null {
  const result = value(f, key, 36);
  if (!result && optional) return null;
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(result)) throw new Error(`Invalid ${key}.`);
  return result;
}
function date(f: FormData, key: string, optional: false): string;
function date(f: FormData, key: string, optional?: true): string | null;
function date(f: FormData, key: string, optional = true): string | null {
  const raw = value(f, key, 40);
  if (!raw && optional) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid ${key}.`);
  return parsed.toISOString();
}
const integer = (f: FormData, key: string, fallback = 100) => {
  const raw = value(f, key, 20);
  const parsed = Number(raw || fallback);
  if (!Number.isSafeInteger(parsed)) throw new Error(`Invalid ${key}.`);
  return parsed;
};
const number = (f: FormData, key: string) => {
  const parsed = Number(value(f, key, 40));
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Invalid ${key}.`);
  return parsed;
};
const version = (f: FormData) => f.get("id") ? integer(f, "version", 1) : undefined;

async function provider(permission: string) {
  const context = await getAppContext();
  if (!context.membership?.permissions.includes(permission)) throw new Error("Not authorized.");
  return context.membership.organizationId;
}
async function execute(work: () => PromiseLike<{ error: { code?: string; message?: string } | null }>): Promise<FoundationState> {
  try {
    const { error } = await work();
    if (error) return { error: error.code === "40001" ? "Record changed or is unavailable. Reload before editing." : error.message || "Not permitted or invalid details." };
    for (const path of ["/clients", "/client-relationships", "/salespeople", "/pricing-tiers", "/orders", "/administration/audit-log"]) revalidatePath(path);
    return { success: "Saved and audited." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save." }; }
}

export async function saveClientCapability(_: FoundationState, f: FormData): Promise<FoundationState> {
  try {
    const p = await provider("client_capabilities.manage");
    const client = await createClient();
    return execute(() => client.rpc("admin_save_client_capability", {
      target_id: uuid(f, "id", true)!, target_provider_id: p, target_client_id: uuid(f, "clientId")!, target_capability_code: value(f, "capabilityCode"), target_status: value(f, "status"), target_effective_from: date(f, "effectiveFrom", false), target_effective_to: date(f, "effectiveTo")!, target_configuration: {}, target_expected_version: version(f),
    }));
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save capability." }; }
}
export async function saveProductOwnership(_: FoundationState, f: FormData): Promise<FoundationState> {
  try {
    const p = await provider("client_ownership.manage");
    const client = await createClient();
    return execute(() => client.rpc("admin_save_client_product_ownership", {
      target_id: uuid(f, "id", true)!, target_provider_id: p, target_client_id: uuid(f, "clientId")!, target_product_id: uuid(f, "productId")!, target_variant_id: uuid(f, "variantId", true)!, target_ownership_type: value(f, "ownershipType"), target_fulfillment_mode: value(f, "fulfillmentMode"), target_status: value(f, "status"), target_effective_from: date(f, "effectiveFrom", false), target_effective_to: date(f, "effectiveTo")!, target_expected_version: version(f),
    }));
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save product ownership." }; }
}
export async function assignInventoryLotOwnership(_: FoundationState, f: FormData): Promise<FoundationState> {
  try {
    const p = await provider("client_ownership.manage");
    const client = await createClient();
    return execute(() => client.rpc("admin_assign_inventory_lot_ownership", { target_provider_id: p, target_lot_id: uuid(f, "lotId")!, target_relationship_id: uuid(f, "relationshipId")! }));
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to assign inventory ownership." }; }
}
export async function saveReferralRelationship(_: FoundationState, f: FormData): Promise<FoundationState> {
  try {
    const p = await provider("client_referrals.manage");
    const client = await createClient();
    return execute(() => client.rpc("admin_save_client_referral_relationship", {
      target_id: uuid(f, "id", true)!, target_provider_id: p, target_affiliate_client_id: uuid(f, "affiliateClientId")!, target_referred_client_id: uuid(f, "referredClientId")!, target_referral_code: value(f, "referralCode", 80), target_status: value(f, "status"), target_effective_from: date(f, "effectiveFrom", false), target_effective_to: date(f, "effectiveTo")!, target_expected_version: version(f),
    }));
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save referral relationship." }; }
}
export async function saveReferralRule(_: FoundationState, f: FormData): Promise<FoundationState> {
  try {
    const p = await provider("referral_commissions.manage");
    const client = await createClient();
    return execute(() => client.rpc("admin_save_referral_commission_rule", {
      target_id: uuid(f, "id", true)!, target_provider_id: p, target_relationship_id: uuid(f, "relationshipId")!, target_name: value(f, "name"), target_basis: value(f, "basis"), target_rate_type: value(f, "rateType"), target_rate: number(f, "rate"), target_currency: value(f, "currency", 3).toUpperCase(), target_priority: integer(f, "priority"), target_effective_from: date(f, "effectiveFrom", false), target_effective_to: date(f, "effectiveTo")!, target_status: value(f, "status"), target_expected_version: version(f),
    }));
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to save referral rule." }; }
}
export async function transitionReferralCommission(_: FoundationState, f: FormData): Promise<FoundationState> {
  try { await provider("referral_commissions.manage"); const client = await createClient(); return execute(() => client.rpc("transition_referral_commission", { target_commission_id: uuid(f, "commissionId")!, target_status: value(f, "status") })); }
  catch (error) { return { error: error instanceof Error ? error.message : "Unable to transition referral commission." }; }
}
export async function createReferralPayout(_: FoundationState, f: FormData): Promise<FoundationState> {
  try {
    const p = await provider("referral_payouts.manage");
    const client = await createClient();
    const ids = value(f, "commissionIds", 4000).split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length) throw new Error("At least one commission ID is required.");
    ids.forEach((id) => { if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) throw new Error("Invalid commission ID."); });
    return execute(() => client.rpc("admin_create_referral_payout", { target_provider_id: p, target_affiliate_client_id: uuid(f, "affiliateClientId")!, target_currency: value(f, "currency", 3).toUpperCase(), target_commission_ids: ids, target_external_reference: value(f, "externalReference", 160), target_idempotency_key: value(f, "idempotencyKey", 120) }));
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to create referral payout." }; }
}
