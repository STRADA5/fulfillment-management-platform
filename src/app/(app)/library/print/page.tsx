import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function LibraryPrintPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("library.print");
  const params = await searchParams;
  if (!params.provider || !params.item || !params.version) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_library_item_delivery" as never, { target_provider_id: params.provider, target_item_id: params.item, target_version_id: params.version, target_mode: "print" } as never);
  if (error || !data || typeof data !== "object") notFound();
  const item = data as Record<string, unknown>;
  return <main className="mx-auto max-w-4xl bg-white p-8 print:max-w-none print:p-0"><PageHeading title={String(item.title ?? "Library item")} description={String(item.summary ?? "")} /><article className="prose mt-8 max-w-none whitespace-pre-wrap text-slate-800">{String(item.body ?? "")}</article><p className="mt-8 text-xs text-slate-500">Printed from the approved Knowledge Library version {params.version}.</p></main>;
}
