"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { NavigationItem } from "@/config/navigation";

export function Sidebar({ items, open, onClose }: { items: NavigationItem[]; open: boolean; onClose: () => void }) {
  const pathname = usePathname();

  return (
    <>
      {open ? <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={onClose} /> : null}
      <aside className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-950 text-white transition-transform lg:translate-x-0`}>
        <div className="border-b border-slate-800 px-6 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Fulfillment</p>
          <p className="mt-1 font-semibold">Management Platform</p>
        </div>
        <nav aria-label="Primary navigation" className="flex-1 space-y-1 overflow-y-auto p-4">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
