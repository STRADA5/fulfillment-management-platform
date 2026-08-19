import { PageHeading } from "@/components/ui/page-heading";

export function ModulePlaceholder({ title }: { title: string }) {
  return (
    <>
      <PageHeading title={title} description={`The ${title.toLowerCase()} workspace is reserved for a later development phase.`} />
      <section className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-medium text-slate-800">No functionality has been configured yet.</p>
        <p className="mt-2 text-sm text-slate-500">This placeholder does not contain production data or business logic.</p>
      </section>
    </>
  );
}
