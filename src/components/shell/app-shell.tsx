"use client";

import { useState, type ReactNode } from "react";

import { setPrimaryOrganizationAction } from "@/lib/admin/membership-actions";
import { logoutAction } from "@/lib/auth/actions";
import type { NavigationItem } from "@/config/navigation";
import { Sidebar } from "@/components/shell/sidebar";

export function AppShell({ children, navigation, organizationName, displayName, email, currentMembershipId, memberships }: {
  children: ReactNode;
  navigation: NavigationItem[];
  organizationName: string;
  displayName: string;
  email: string;
  currentMembershipId?: string;
  memberships: Array<{ id: string; organizationName: string; roleCode: string }>;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar items={navigation} open={navigationOpen} onClose={() => setNavigationOpen(false)} />
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setNavigationOpen(true)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:hidden"
            >
              Menu
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current organization</p>
              {memberships.length > 1 ? (
                <form action={setPrimaryOrganizationAction}>
                  <label className="sr-only" htmlFor="active-membership">Current organization</label>
                  <select
                    id="active-membership"
                    name="membershipId"
                    defaultValue={currentMembershipId}
                    onChange={(event) => event.currentTarget.form?.requestSubmit()}
                    className="max-w-56 truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-semibold text-slate-900"
                  >
                    {memberships.map((membership) => (
                      <option key={membership.id} value={membership.id}>
                        {membership.organizationName} · {membership.roleCode}
                      </option>
                    ))}
                  </select>
                </form>
              ) : <p className="truncate text-sm font-semibold text-slate-900">{organizationName}</p>}
            </div>
          </div>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg px-3 py-2 text-right hover:bg-slate-50">
              <span className="block text-sm font-semibold text-slate-900">{displayName}</span>
              <span className="hidden text-xs text-slate-500 sm:block">{email}</span>
            </summary>
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <form action={logoutAction}>
                <button type="submit" className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100">
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </header>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </div>
    </div>
  );
}
