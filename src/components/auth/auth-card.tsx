import type { ReactNode } from "react";
import Link from "next/link";

export function AuthCard({ title, description, children, footer }: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: { href: string; label: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="text-sm font-semibold text-slate-500 hover:text-slate-800">
          Fulfillment Management Platform
        </Link>
        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-8">{children}</div>
        {footer ? (
          <Link href={footer.href} className="mt-6 block text-center text-sm font-medium text-slate-700 hover:text-slate-950">
            {footer.label}
          </Link>
        ) : null}
      </section>
    </main>
  );
}
