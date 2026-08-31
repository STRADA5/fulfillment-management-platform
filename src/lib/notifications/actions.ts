"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type NotificationActionState = { error?: string; success?: string };

export async function saveNotificationPreference(_: NotificationActionState, formData: FormData): Promise<NotificationActionState> {
  const user = await requireUser();
  try {
    const organizationId = String(formData.get("organizationId") ?? "").trim();
    const eventType = String(formData.get("eventType") ?? "").trim();
    const enabled = String(formData.get("enabled") ?? "") === "on";
    if (!organizationId || !eventType || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(organizationId)) throw new Error("Invalid notification preference.");
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_notification_preference", {
      target_organization_id: organizationId,
      target_user_id: user.id,
      target_event_type: eventType,
      target_in_app_enabled: enabled,
    });
    if (error) return { error: "Preference change was denied." };
    revalidatePath("/dashboard");
    return { success: "Notification preference saved." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to save preference." };
  }
}

export async function processLocalNotificationOutbox(_: NotificationActionState, formData: FormData): Promise<NotificationActionState> {
  await requireUser();
  try {
    const organizationId = String(formData.get("organizationId") ?? "").trim();
    if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(organizationId)) throw new Error("Invalid organization.");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("process_local_notification_outbox", { target_organization_id: organizationId, target_limit: 100 });
    if (error) return { error: "Notification processing was denied." };
    revalidatePath("/dashboard");
    return { success: `Processed ${data ?? 0} local notification(s).` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to process notifications." };
  }
}
