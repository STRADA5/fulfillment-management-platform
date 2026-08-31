"use client";
import { useActionState } from "react";
import type { FoundationState } from "@/lib/customers/actions";

export type FoundationField = { name: string; label: string; type?: string; required?: boolean; readOnly?: boolean; options?: { value: string; label: string }[] };
export function FoundationForm({ title, action, fields, values = {} }: {
  title: string; action: (state: FoundationState, form: FormData) => Promise<FoundationState>;
  fields: FoundationField[]; values?: Record<string, string | number | boolean | null | undefined>;
}) {
  const [state, submit, pending] = useActionState(action, {});
  return <form action={submit} className="rounded-xl border bg-white p-5 shadow-sm">
    <h2 className="text-lg font-semibold">{title}</h2>
    {values.id ? <><input type="hidden" name="id" value={String(values.id)} /><input type="hidden" name="version" value={String(values.version ?? "")} /></> : null}
    <div className="mt-4 grid gap-4 sm:grid-cols-2">{fields.map(f => <label key={f.name} className="text-sm font-medium">{f.label}
      {f.options ? <select name={f.name} required={f.required} defaultValue={String(values[f.name] ?? f.options[0]?.value ?? "")} className="mt-1 w-full rounded border p-2">{f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        : f.type === "checkbox" ? <input name={f.name} type="checkbox" defaultChecked={Boolean(values[f.name])} className="ml-3" />
        : <input name={f.name} type={f.type ?? "text"} required={f.required} readOnly={f.readOnly} defaultValue={String(values[f.name] ?? "")} className="mt-1 w-full rounded border p-2 read-only:bg-slate-100" />}
    </label>)}</div>
    <button disabled={pending} className="mt-4 rounded bg-slate-950 px-4 py-2 text-white disabled:opacity-50">{pending ? "Saving…" : "Save"}</button>
    {state.error ? <p role="alert" className="mt-3 text-red-700">{state.error}</p> : state.success ? <p role="status" className="mt-3 text-emerald-700">{state.success} Reload before another edit.</p> : null}
  </form>;
}
