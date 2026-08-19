"use client";

import { useActionState } from "react";

import type { AuthActionState } from "@/lib/auth/actions";

const initialState: AuthActionState = {};

export function AuthForm({
  action,
  fields,
  submitLabel,
  hiddenFields,
}: {
  action: (state: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  fields: Array<{ name: string; label: string; type: "email" | "password"; autoComplete: string; minLength?: number }>;
  submitLabel: string;
  hiddenFields?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {hiddenFields ? Object.entries(hiddenFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      )) : null}
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="block text-sm font-medium text-slate-800">{field.label}</label>
          <input
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            minLength={field.minLength}
            required
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-slate-600 focus:ring-2 focus:ring-slate-200"
          />
        </div>
      ))}
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      {state.success ? <p role="status" className="text-sm text-emerald-700">{state.success}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}
