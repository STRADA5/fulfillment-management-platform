import Link from "next/link";

import { PageHeading } from "@/components/ui/page-heading";
import { administrationNavigation } from "@/config/navigation";
import { can, getAppContext } from "@/lib/auth/authorization";

export default async function AdministrationPage() {
  const context = await getAppContext();
  const items = administrationNavigation.filter((item) => !item.permission || can(context, item.permission));
  return (
    <>
      <PageHeading title="Administration" description="Manage authorized platform and organization settings." />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-xl border border-slate-200 bg-white p-5 font-semibold text-slate-900 shadow-sm transition hover:border-slate-400">
            {item.label}
            <span className="mt-2 block text-sm font-normal text-slate-500">Open {item.label.toLowerCase()}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
