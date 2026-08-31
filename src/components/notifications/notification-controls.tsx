"use client";

import { useActionState } from "react";
import { processLocalNotificationOutbox, saveNotificationPreference, type NotificationActionState } from "@/lib/notifications/actions";

export function NotificationControls({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const [preferenceState, preferenceAction, preferencePending] = useActionState<NotificationActionState, FormData>(saveNotificationPreference, {});
  const [processState, processAction, processPending] = useActionState<NotificationActionState, FormData>(processLocalNotificationOutbox, {});
  return <div className="mt-6 grid gap-4 md:grid-cols-2">
    <form action={preferenceAction} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Notification preferences</h2>
      <p className="mt-1 text-sm text-slate-600">Control in-app status updates for your signed-in account.</p>
      <input type="hidden" name="organizationId" value={organizationId}/>
      <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked/> Show order and shipment updates</label>
      <input type="hidden" name="eventType" value="*"/>
      <button disabled={preferencePending} className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">{preferencePending ? "Saving…" : "Save preference"}</button>
      {preferenceState.error ? <p role="alert" className="mt-2 text-sm text-red-700">{preferenceState.error}</p> : preferenceState.success ? <p role="status" className="mt-2 text-sm text-emerald-700">{preferenceState.success}</p> : null}
    </form>
    {canManage ? <form action={processAction} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-slate-900">Local outbox processor</h2>
      <p className="mt-1 text-sm text-slate-600">Runs the deterministic local/test adapter. External providers are intentionally disabled.</p>
      <input type="hidden" name="organizationId" value={organizationId}/>
      <button disabled={processPending} className="mt-4 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white">{processPending ? "Processing…" : "Process pending events"}</button>
      {processState.error ? <p role="alert" className="mt-2 text-sm text-red-700">{processState.error}</p> : processState.success ? <p role="status" className="mt-2 text-sm text-emerald-700">{processState.success}</p> : null}
    </form> : null}
  </div>;
}
