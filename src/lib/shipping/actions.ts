"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type ShippingActionState = { error?: string; success?: string };

const text = (form: FormData, name: string, max = 200, required = false) => {
  const value = String(form.get(name) ?? "").trim();
  if ((required && !value) || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
};
const uuid = (form: FormData, name: string) => {
  const value = text(form, name, 36, true);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error(`Invalid ${name}.`);
  return value;
};
const number = (form: FormData, name: string) => {
  const value = Number(text(form, name, 40, true));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid ${name}.`);
  return value;
};
const key = (form: FormData) => text(form, "requestKey", 120, true);

async function mutate(permission: string, fn: string, args: Record<string, unknown>): Promise<ShippingActionState> {
  try {
    const context = await getAppContext();
    if (!context.membership?.permissions.includes(permission)) throw new Error("Not authorized.");
    const supabase = await createClient();
    const { error } = await supabase.rpc(fn as never, { target_organization_id: context.membership.organizationId, ...args } as never);
    if (error) return { error: error.message };
    revalidatePath("/shipping");
    revalidatePath("/fulfillment");
    revalidatePath("/administration/audit-log");
    return { success: "Shipping operation completed." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Shipping operation failed." };
  }
}

export async function configurePackageShipping(_: ShippingActionState, form: FormData) {
  return mutate("shipping.manage", "admin_set_package_shipping", {
    target_package_id: uuid(form, "packageId"), target_carrier_code: text(form, "carrier", 30, true).toLowerCase(), target_service_code: text(form, "service", 60, true).toLowerCase(),
    target_length: number(form, "length"), target_width: number(form, "width"), target_height: number(form, "height"), target_dimension_unit: text(form, "dimensionUnit", 8) || "in", target_idempotency_key: key(form),
  });
}
export async function quoteShipmentShipping(_: ShippingActionState, form: FormData) {
  return mutate("shipping.quote", "admin_quote_shipment_shipping", { target_shipment_id: uuid(form, "shipmentId"), target_currency: text(form, "currency", 3, true).toUpperCase(), target_idempotency_key: key(form) });
}
export async function createTestShippingLabels(_: ShippingActionState, form: FormData) {
  return mutate("shipping.label.create", "admin_create_test_shipping_labels", { target_shipment_id: uuid(form, "shipmentId"), target_idempotency_key: key(form) });
}
export async function ingestTrackingEvent(_: ShippingActionState, form: FormData) {
  const occurredAt = text(form, "occurredAt", 40, true);
  if (Number.isNaN(Date.parse(occurredAt))) throw new Error("Invalid occurredAt.");
  return mutate("shipping.tracking.manage", "admin_ingest_tracking_event", { target_package_id: uuid(form, "packageId"), target_provider_event_id: text(form, "providerEventId", 120, true), target_normalized_status: text(form, "status", 30, true), target_occurred_at: occurredAt, target_message: text(form, "message", 500), target_idempotency_key: key(form) });
}
export async function voidShippingLabel(_: ShippingActionState, form: FormData) {
  return mutate("shipping.label.void", "admin_void_shipping_label", { target_package_id: uuid(form, "packageId"), target_idempotency_key: key(form) });
}
