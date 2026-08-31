import Link from "next/link";
import { CatalogForm, type CatalogField } from "@/components/catalog/catalog-form";
import { PageHeading } from "@/components/ui/page-heading";
import { can, requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  linkCalculatorSource,
  saveCalculatorPlugin,
  saveCalculatorVersion,
  saveLibraryCategory,
  saveLibraryItem,
  saveLibrarySection,
  saveLibraryTag,
  savePersonalCalculatorConfiguration,
  setLibraryItemTags,
  shareLibraryItem,
  transitionCalculatorVersion,
  transitionLibraryVersion,
} from "@/lib/knowledge-library/actions";

type Row = Record<string, unknown>;
const rows = (value: unknown) => Array.isArray(value) ? value.filter((item): item is Row => Boolean(item && typeof item === "object")) : [];
const stringValue = (row: Row, key: string) => typeof row[key] === "string" ? row[key] as string : "";
const idOptions = (value: unknown, labelKey: string, empty = "None") => [{ value: "", label: empty }, ...rows(value).map((row) => ({ value: stringValue(row, "id"), label: stringValue(row, labelKey) || stringValue(row, "name") || stringValue(row, "title") }))];

export default async function KnowledgeLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const context = await requirePermission("library.view");
  if (!context.membership) return null;
  const params = await searchParams;
  const supabase = await createClient();
  const organizationId = context.membership.organizationId;
  const { data: organization } = await supabase.from("organizations").select("organization_type,parent_organization_id").eq("id", organizationId).maybeSingle();
  const isClient = organization?.organization_type === "client_company";
  const providerId = isClient ? organization.parent_organization_id : organizationId;
  const [libraryResult, navigationResult] = providerId && !isClient
    ? await Promise.all([supabase.rpc("get_library_context", { target_provider_id: providerId ?? "", target_query: params.q ?? undefined }), supabase.rpc("get_library_navigation", { target_provider_id: providerId ?? "" })])
    : providerId
      ? [await supabase.rpc("get_client_library", { target_provider_id: providerId ?? "", target_query: params.q ?? undefined }), { data: null, error: null }]
      : [{ data: null, error: { message: "No provider relationship" } }, { data: null, error: null }];
  const library = (libraryResult.data && typeof libraryResult.data === "object" ? libraryResult.data : {}) as Row;
  const navigation = (navigationResult.data && typeof navigationResult.data === "object" ? navigationResult.data : {}) as Row;
  const items = rows(library.items);
  const sections = rows(navigation.sections);
  const categories = rows(navigation.categories);
  const tags = rows(navigation.tags);
  const calculators = rows(library.calculators);
  const internal = !isClient && Boolean(providerId);
  const sectionOptions = idOptions(sections, "name", "Select section");
  const categoryOptions = idOptions(categories, "name");
  const itemOptions = items.map((row) => ({ value: stringValue(row, "id") || stringValue(row, "item_id"), label: stringValue(row, "title") }));
  const calculatorOptions = calculators.map((row) => ({ value: stringValue(row, "version_id"), label: `${stringValue(row, "name")} · ${stringValue(row, "version")}` }));
  const itemFields: CatalogField[] = [
    { name: "sectionId", label: "Section", required: true, options: sectionOptions },
    { name: "categoryId", label: "Category", options: categoryOptions },
    { name: "itemType", label: "Type", options: [{ value: "protocol", label: "Protocol" }, { value: "research", label: "Research / reference" }, { value: "resource", label: "Reference resource" }] },
    { name: "slug", label: "Stable slug", required: true },
    { name: "title", label: "Title", required: true },
    { name: "summary", label: "Summary", type: "textarea" },
    { name: "body", label: "Body", type: "textarea", required: true },
    { name: "documentMetadata", label: "Document metadata JSON" },
    { name: "sourceMetadata", label: "Citation/source metadata JSON" },
    { name: "visibility", label: "Visibility", options: [{ value: "internal", label: "Internal" }, { value: "fulfillment", label: "Fulfillment" }, { value: "salesperson", label: "Salesperson" }, { value: "client_safe", label: "Client-safe" }] },
    { name: "clientSafe", label: "Client-safe version", type: "checkbox" },
  ];
  return <>
    <PageHeading title="Knowledge Library & Tools" description="Provider-controlled protocols, research, reference materials, and versioned calculator plugin metadata with auditable client-safe delivery." />
    {libraryResult.error ? <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Library content is not available for this organization yet.</p> : null}
    {isClient ? <p className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">You can view only provider-approved, explicitly shared client-safe materials. Commission, internal protocols, and calculator administration remain confidential.</p> : null}
    <form className="mt-6 flex gap-3"><label className="flex-1 text-sm font-medium text-slate-700">Search library<input name="q" defaultValue={params.q ?? ""} placeholder="Title, summary, or tag" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label><button className="self-end rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Search</button></form>
    <section className="mt-6 grid gap-4 sm:grid-cols-3">{sections.map((section) => <div key={stringValue(section, "id")} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">{stringValue(section, "section_type")}</p><h2 className="mt-1 font-semibold">{stringValue(section, "name")}</h2><p className="mt-1 text-sm text-slate-600">{stringValue(section, "description")}</p></div>)}{!sections.length ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Provider sections are not exposed in this view.</div> : null}</section>
    {internal ? <p className="mt-4 text-xs text-slate-500">Extensible navigation: {sections.length} sections · {categories.length} categories · {tags.length} tags.</p> : null}
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Published library items</h2><div className="mt-4 grid gap-3">{items.map((item) => { const itemId = stringValue(item, "id") || stringValue(item, "item_id"); const versionId = stringValue(item, "version_id"); return <article key={`${itemId}-${versionId}`} className="rounded-lg border border-slate-100 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{stringValue(item, "title")}</h3><p className="text-sm text-slate-600">{stringValue(item, "summary")}</p></div>{itemId && versionId && providerId ? <span className="flex gap-3 text-sm"><Link className="text-blue-700" href={`/library/print?provider=${providerId}&item=${itemId}&version=${versionId}`}>Print</Link><Link className="text-blue-700" href={`/api/library/delivery?provider=${providerId}&item=${itemId}&version=${versionId}&mode=download`}>Download</Link></span> : null}</div></article>; })}{!items.length ? <p className="text-sm text-slate-600">No published items match this search.</p> : null}</div></section>
    {internal && can(context, "library.categories.manage") ? <section className="mt-6 grid gap-6 xl:grid-cols-3"><CatalogForm title="Add library section" action={saveLibrarySection} fields={[{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }, { name: "description", label: "Description" }, { name: "sectionType", label: "Section type", options: [{ value: "custom", label: "Custom" }, { value: "protocols", label: "Protocols" }, { value: "research", label: "Research" }, { value: "calculators", label: "Calculators" }] }, { name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }, { name: "displayOrder", label: "Display order", type: "number" }]} /><CatalogForm title="Add category" action={saveLibraryCategory} fields={[{ name: "sectionId", label: "Section", required: true, options: sectionOptions }, { name: "parentCategoryId", label: "Parent category", options: idOptions(categories, "name") }, { name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }, { name: "description", label: "Description" }, { name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }, { name: "displayOrder", label: "Display order", type: "number" }]} /><CatalogForm title="Add tag" action={saveLibraryTag} fields={[{ name: "name", label: "Name", required: true }, { name: "slug", label: "Slug", required: true }]} /></section> : null}
    {internal && can(context, "library.create") ? <section className="mt-6"><CatalogForm title="Create protocol or reference draft" action={saveLibraryItem} fields={itemFields} values={{ itemType: "protocol", documentMetadata: "{}", sourceMetadata: "{}", visibility: "internal" }} /></section> : null}
    {internal && can(context, "library.edit") && itemOptions.length ? <section className="mt-6"><CatalogForm title="Set item tags" action={setLibraryItemTags} fields={[{ name: "itemId", label: "Item", required: true, options: itemOptions }, { name: "tagIds", label: "Tag ids (comma separated)", required: true }]} /></section> : null}
    {internal && can(context, "library.approve") && itemOptions.length ? <section className="mt-6"><CatalogForm title="Advance library lifecycle" action={transitionLibraryVersion} fields={[{ name: "versionId", label: "Version id", required: true }, { name: "status", label: "Next status", options: [{ value: "approved", label: "Approve" }, { value: "published", label: "Publish" }, { value: "archived", label: "Archive" }] }]} /></section> : null}
    {internal && can(context, "library.share_client") && itemOptions.length ? <section className="mt-6"><CatalogForm title="Share client-safe version" action={shareLibraryItem} fields={[{ name: "itemId", label: "Item", required: true, options: itemOptions }, { name: "versionId", label: "Published version id", required: true }, { name: "clientId", label: "Client organization id", required: true }, { name: "effectiveFrom", label: "Effective from", type: "datetime-local" }, { name: "effectiveTo", label: "Effective to", type: "datetime-local" }]} /></section> : null}
    {internal && can(context, "calculator.manage") ? <section className="mt-6 grid gap-6 xl:grid-cols-2"><CatalogForm title="Register calculator plugin" action={saveCalculatorPlugin} fields={[{ name: "slug", label: "Plugin slug", required: true }, { name: "name", label: "Name", required: true }, { name: "description", label: "Description" }, { name: "pluginKind", label: "Kind", options: [{ value: "external", label: "External module" }, { value: "native", label: "Platform-native" }] }, { name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }]} /><CatalogForm title="Register calculator version metadata" action={saveCalculatorVersion} fields={[{ name: "pluginId", label: "Plugin id", required: true }, { name: "version", label: "Version", required: true }, { name: "manifest", label: "Manifest JSON", required: true }, { name: "inputSchema", label: "Validated input schema JSON", required: true }, { name: "outputSchema", label: "Output schema JSON", required: true }, { name: "unitSchema", label: "Unit schema JSON", required: true }, { name: "engineReference", label: "Engine reference" }, { name: "dosingMode", label: "Dosing mode", options: [{ value: "none", label: "No dosing authority" }, { value: "reference_only", label: "Reference only" }] }, { name: "checksum", label: "Checksum" }]} /></section> : null}
    {internal && can(context, "calculator.manage") && calculatorOptions.length ? <section className="mt-6 grid gap-6 xl:grid-cols-2"><CatalogForm title="Advance calculator version" action={transitionCalculatorVersion} fields={[{ name: "versionId", label: "Calculator version id", required: true, options: calculatorOptions }, { name: "status", label: "Next status", options: [{ value: "approved", label: "Approve" }, { value: "published", label: "Publish" }, { value: "archived", label: "Archive" }] }]} /><CatalogForm title="Link approved protocol/data source" action={linkCalculatorSource} fields={[{ name: "pluginVersionId", label: "Plugin version id", required: true, options: calculatorOptions }, { name: "itemId", label: "Library item id", required: true, options: itemOptions }, { name: "libraryVersionId", label: "Approved library version id", required: true }, { name: "relationshipType", label: "Relationship", options: [{ value: "approved_protocol", label: "Approved protocol" }, { value: "approved_data_source", label: "Approved data source" }] }]} /></section> : null}
    {internal && can(context, "calculator.personal") ? <section className="mt-6"><CatalogForm title="Your personal calculator template" action={savePersonalCalculatorConfiguration} fields={[{ name: "pluginVersionId", label: "Published plugin version", required: true, options: calculatorOptions }, { name: "name", label: "Template name", required: true }, { name: "configuration", label: "Personal configuration JSON", required: true }, { name: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }]} /></section> : null}
  </>;
}
