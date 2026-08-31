"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; success?: string };
const uuid = (value: FormDataEntryValue | null) => { const v = String(value ?? "").trim(); if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(v)) throw new Error("Invalid identifier."); return v; };
const text = (value: FormDataEntryValue | null, max = 2000) => { const v = String(value ?? "").trim(); if (v.length > max || /[\u0000-\u001f]/.test(v)) throw new Error("Invalid text."); return v; };
const key = (value: FormDataEntryValue | null) => { const v = text(value, 120); if (v.length < 8) throw new Error("A unique request key is required."); return v; };

export async function acknowledgeCase(_: State, formData: FormData): Promise<State> {
  await requireUser();
  try { const s = await createClient(); const { error } = await s.rpc("acknowledge_discrepancy_case", { target_case_id: uuid(formData.get("caseId")), target_acknowledgment: text(formData.get("acknowledgment"), 20), target_note: text(formData.get("note")), target_idempotency_key: key(formData.get("idempotencyKey")) }); if (error) return { error: "Acknowledgment was denied." }; revalidatePath("/exceptions"); return { success: "Acknowledgment recorded." }; } catch (e) { return { error: e instanceof Error ? e.message : "Unable to acknowledge case." }; }
}

export async function createReturn(_: State, formData: FormData): Promise<State> {
  await requireUser();
  try { const s = await createClient(); const lines = JSON.parse(text(formData.get("lines"), 20000)) as unknown; if (!Array.isArray(lines) || lines.length < 1) throw new Error("At least one shipment line is required."); const discrepancyCaseId = formData.get("caseId") ? uuid(formData.get("caseId")) : null; const { error } = await s.rpc("create_return_authorization", { target_organization_id: uuid(formData.get("organizationId")), target_client_organization_id: uuid(formData.get("clientOrganizationId")), target_order_id: uuid(formData.get("orderId")), target_original_shipment_id: uuid(formData.get("shipmentId")), target_discrepancy_case_id: discrepancyCaseId as string, target_lines: lines, target_reason: text(formData.get("reason")), target_idempotency_key: key(formData.get("idempotencyKey")) }); if (error) return { error: "Return authorization was denied." }; revalidatePath("/exceptions"); return { success: "Return authorization created." }; } catch (e) { return { error: e instanceof Error ? e.message : "Unable to create return." }; }
}
