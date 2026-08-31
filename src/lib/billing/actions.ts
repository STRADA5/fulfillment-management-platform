"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type State = { error?: string; success?: string };
const value = (form: FormData, name: string, max = 2000) => {
  const result = String(form.get(name) ?? "").trim();
  if (result.length > max || /[\u0000-\u001f]/.test(result)) throw new Error(`Invalid ${name}.`);
  return result;
};
const uuid = (form: FormData, name: string) => {
  const result = value(form, name, 36);
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(result)) throw new Error(`Invalid ${name}.`);
  return result;
};
const key = (form: FormData) => { const result = value(form, "idempotencyKey", 120); if (result.length < 8) throw new Error("A unique request key is required."); return result; };
const money = (form: FormData) => { const result = value(form, "amount", 40); if (!/^(?:\d+)(?:\.\d{1,6})?$/.test(result) || Number(result) <= 0) throw new Error("Invalid amount."); return result; };
async function execute(work: () => PromiseLike<{ error: { code?: string } | null }>): Promise<State> {
  await requireUser();
  try { const { error } = await work(); if (error) return { error: "Not permitted or invalid financial details." }; revalidatePath("/billing"); revalidatePath("/dashboard"); return { success: "Financial action recorded and audited." }; }
  catch (error) { return { error: error instanceof Error ? error.message : "Unable to complete financial action." }; }
}
export async function createInvoice(_: State, form: FormData) { return execute(async () => (await createClient()).rpc("create_invoice_from_order", { target_organization_id: uuid(form, "organizationId"), target_order_id: uuid(form, "orderId"), target_idempotency_key: key(form), target_due_at: undefined })); }
export async function issueInvoice(_: State, form: FormData) { return execute(async () => (await createClient()).rpc("issue_invoice", { target_organization_id: uuid(form, "organizationId"), target_invoice_id: uuid(form, "invoiceId"), target_idempotency_key: key(form) })); }
export async function recordPayment(_: State, form: FormData) { return execute(async () => (await createClient()).rpc("record_manual_payment", { target_organization_id: uuid(form, "organizationId"), target_invoice_id: uuid(form, "invoiceId"), target_amount: money(form) as unknown as number, target_currency: value(form, "currency", 3).toUpperCase(), target_reference: value(form, "reference"), target_idempotency_key: key(form) })); }
export async function createCredit(_: State, form: FormData) { return execute(async () => (await createClient()).rpc("create_credit_memo", { target_organization_id: uuid(form, "organizationId"), target_invoice_id: uuid(form, "invoiceId"), target_amount: money(form) as unknown as number, target_reason: value(form, "reason"), target_rma_id: (form.get("rmaId") ? uuid(form, "rmaId") : null) as unknown as string, target_idempotency_key: key(form) })); }
export async function recordRefund(_: State, form: FormData) { return execute(async () => (await createClient()).rpc("record_refund", { target_organization_id: uuid(form, "organizationId"), target_payment_id: uuid(form, "paymentId"), target_amount: money(form) as unknown as number, target_reason: value(form, "reason"), target_idempotency_key: key(form) })); }
