"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type FoundationState = { error?: string; success?: string };
const value = (f: FormData, key: string, max = 160) => {
  const result = String(f.get(key) ?? "").trim();
  if (result.length > max || /[\u0000-\u001f]/.test(result)) throw Error(`Invalid ${key}.`);
  return result;
};
const uuid = (f: FormData, key: string, optional = false) => {
  const result = value(f, key, 36);
  if (!result && optional) return null;
  if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(result)) throw Error(`Invalid ${key}.`);
  return result;
};
const status = (f: FormData) => {
  const result = value(f, "status");
  if (result !== "active" && result !== "inactive" && result !== "suspended") throw Error("Invalid status.");
  return result;
};
const email = (f: FormData) => {
  const result = value(f, "email", 254);
  if (result && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw Error("Invalid email.");
  return result;
};
const required = (f: FormData, key: string, max = 160) => {
  const result = value(f, key, max); if (!result) throw Error(`${key} is required.`); return result;
};
const version = (f: FormData) => {
  if (!f.get("id")) return null;
  const n = Number(value(f, "version", 12));
  if (!Number.isSafeInteger(n) || n < 1) throw Error("Missing record version. Reload the page.");
  return n;
};
async function execute(work: () => PromiseLike<{ error: { code?: string } | null }>): Promise<FoundationState> {
  await requireUser();
  try {
    const { error } = await work();
    if (error) return { error: error.code === "40001" ? "Record changed or is unavailable. Reload before editing." : "Not permitted or invalid details. Check organization, permissions, status, and required fields." };
    revalidatePath("/clients"); revalidatePath("/customers"); revalidatePath("/administration/audit-log");
    return { success: "Saved and audited." };
  } catch (e) { return { error: e instanceof Error ? e.message : "Unable to save." }; }
}
export async function saveClientAccount(_: FoundationState, f: FormData) {
  return execute(async () => {
    const s = await createClient(), slug = required(f, "slug", 100);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw Error("Invalid client slug.");
    return s.rpc("admin_save_client_account", { target_id: uuid(f, "id", true)!, parent_id: uuid(f, "parentId")!, target_name: required(f, "name"), target_slug: slug, target_email: email(f), target_phone: value(f, "phone", 40), target_status: status(f) });
  });
}
export async function saveClientService(_: FoundationState, f: FormData) {
  return execute(async () => {
    const s = await createClient(), access = value(f, "access");
    if (!["none", "read", "manage"].includes(access)) throw Error("Invalid service access.");
    return s.rpc("admin_save_client_service", { target_id: uuid(f, "id", true)!, provider_id: uuid(f, "providerId")!, client_id: uuid(f, "clientId")!, target_status: status(f), target_access: access, expected_version: version(f)! });
  });
}
export async function saveCustomer(_: FoundationState, f: FormData) {
  return execute(async () => {
    const s = await createClient(), number = required(f, "number", 60);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,59}$/.test(number)) throw Error("Invalid customer number.");
    return s.rpc("admin_save_customer", { target_id: uuid(f, "id", true)!, client_id: uuid(f, "clientId")!, target_number: number, target_name: required(f, "name"), target_email: email(f), target_phone: value(f, "phone", 40), target_status: status(f), expected_version: version(f)! });
  });
}
export async function saveAddress(_: FoundationState, f: FormData) {
  return execute(async () => {
    const s = await createClient(), country = required(f, "country_code", 2).toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) throw Error("Use a two-letter country code.");
    const address = { label: required(f, "label", 80), recipient: required(f, "recipient"), line1: required(f, "line1", 200), line2: value(f, "line2", 200), city: required(f, "city", 100), region: value(f, "region", 100), postal_code: value(f, "postal_code", 24), country_code: country };
    return s.rpc("admin_save_customer_address", { target_id: uuid(f, "id", true)!, client_id: uuid(f, "clientId")!, target_customer_id: uuid(f, "customerId")!, target_address: address, target_status: status(f), shipping_default: f.get("shipping") === "on", billing_default: f.get("billing") === "on", expected_version: version(f)! });
  });
}
